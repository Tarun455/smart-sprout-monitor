#include <Arduino.h>
#include <WiFi.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "esp_camera.h"
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include "time.h"
#include "FS.h"
#include <SD_MMC.h>
#include <Preferences.h> // *** STABILITY: Used for saving settings permanently ***

// --- Preferences Namespace ---
Preferences preferences;

// --- Debug flags ---
#define DEBUG_FIREBASE_CHECKS false
#define DEBUG_FIREBASE_OPERATIONS true

// --- WiFi & NTP Credentials (Update these) ---
const char* ssid = "[YOUR_WIFI_SSID]";
const char* password = "[YOUR_WIFI_PASSWORD]";
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800; // India timezone: UTC+5:30
const int daylightOffset_sec = 0;

// --- Firebase Configuration (Update these) ---
#define FIREBASE_API_KEY "[YOUR_FIREBASE_API_KEY]"
#define FIREBASE_DATABASE_URL "[YOUR_FIREBASE_DATABASE_URL]"
#define FIREBASE_USER_EMAIL "[YOUR_EMAIL]"
#define FIREBASE_USER_PASSWORD "[YOUR_PASSWORD]"

// --- Firebase paths ---
#define FB_COMMANDS_PATH "/commands"
#define FB_STATUS_PATH "/status"
#define FB_PHOTOS_PATH "/photos"

// --- Pin Definitions & Settings for AI-THINKER Model ---
#define FLASH_LED_PIN 4
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// --- Global Variables ---
bool flashState = LOW;
unsigned long previousMillis = 0;
unsigned long interval = 12 * 60 * 60 * 1000; // Default 12 hours
const unsigned long MIN_INTERVAL = 15 * 60 * 1000; // 15 minutes
const unsigned long MAX_INTERVAL = 48 * 60 * 60 * 1000; // 48 hours

// Wi-Fi connection parameters
#define WIFI_RETRY_DELAY 1000
#define MAX_WIFI_CONNECT_TIME 480000

// Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// State tracking variables
String lastProcessedCommandId = "";
bool sendPhoto = false;
bool ntpInitialized = false;
bool sdCardPresent = false;

// --- Forward Declarations ---
String getFormattedDate(unsigned long dummy);
String base64Encode(const uint8_t* data, size_t length);
void updateFirebaseStatus();
bool connectToWiFi();
void initNTP();
void uploadQueuedPhotos();
void loadSettings();
void saveSettings();

// --- Camera and Hardware Initialization ---

void configInitCamera(){
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_LATEST;

  if(psramFound()){
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 10;
    config.fb_count = 1;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 10;
    config.fb_count = 1;
  }
  
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("FATAL: Camera init failed with error 0x%x. Restarting in 5s...\n", err);
    delay(5000);
    ESP.restart();
  }
}

// --- SD Card and Photo Management Functions ---

void savePhotoToSD(camera_fb_t * fb) {
  if (!sdCardPresent) {
    Serial.println("ERROR: Cannot save to SD card, not present or failed to mount.");
    return;
  }
  
  time_t now = time(nullptr);
  if (now < 1000000000) {
      now = millis() / 1000;
  }
  String path = "/photo_" + String(now) + ".jpg";

  Serial.printf("Attempting to save photo to SD card at: %s\n", path.c_str());
  File file = SD_MMC.open(path.c_str(), FILE_WRITE);
  if (!file) {
    Serial.println("ERROR: Failed to open file for writing on SD Card.");
    return;
  }
  
  if (file.write(fb->buf, fb->len)) {
    Serial.printf("SUCCESS: File saved to SD card (%d bytes).\n", fb->len);
  } else {
    Serial.println("ERROR: File write to SD card failed.");
  }
  
  file.close();
}

bool uploadToFirebase(const uint8_t* imageData, size_t imageLen, time_t timestamp) {
  if (!Firebase.ready() || WiFi.status() != WL_CONNECTED) {
    Serial.println("Cannot upload: Firebase not ready or WiFi disconnected.");
    return false;
  }

  String photoId = "photo_" + String(timestamp);
  unsigned long jsTimestamp = timestamp * 1000UL;
  String formattedDate = getFormattedDate(jsTimestamp);
  
  String imageBase64 = base64Encode(imageData, imageLen);
  if (imageBase64.length() == 0) {
      Serial.println("ERROR: Base64 encoding failed. Photo not uploaded.");
      return false;
  }

  FirebaseJson json;
  json.set("timestamp", jsTimestamp);
  json.set("imageData", imageBase64);
  json.set("caption", formattedDate);
  
  String photoPath = String(FB_PHOTOS_PATH) + "/" + photoId;
  Serial.println("Uploading photo to Firebase at: " + photoPath);
  
  if (Firebase.RTDB.setJSON(&fbdo, photoPath.c_str(), &json)) {
    Serial.println("SUCCESS: Photo uploaded to Firebase.");
    return true;
  } else {
    Serial.println("ERROR: Failed to upload photo to Firebase: " + fbdo.errorReason());
    return false;
  }
}

void takeAndProcessPhoto() {
  Serial.println("--- Starting Photo Capture Process ---");
  bool previousFlashState = flashState;
  
  digitalWrite(FLASH_LED_PIN, HIGH);
  delay(500); // Allow flash to power up
  
  camera_fb_t * fb = NULL;
  Serial.println("Getting frame from camera...");
  fb = esp_camera_fb_get();
  
  if(!fb) {
    Serial.println("FATAL: Camera capture failed. Check camera connection. Restarting in 5s...");
    digitalWrite(FLASH_LED_PIN, previousFlashState);
    delay(5000);
    ESP.restart(); // A failed capture is often a fatal hardware error
    return;
  }
  
  Serial.printf("Photo captured successfully. Size: %d bytes\n", fb->len);
  
  if (Firebase.ready() && WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi Connected. Uploading directly to Firebase.");
    time_t now = time(nullptr);
    if(uploadToFirebase(fb->buf, fb->len, now)) {
      updateFirebaseStatus();
    }
  } else {
    Serial.println("WiFi Disconnected. Saving photo to SD Card for later.");
    savePhotoToSD(fb);
  }
  
  esp_camera_fb_return(fb);
  digitalWrite(FLASH_LED_PIN, previousFlashState);
  Serial.println("--- Photo Capture Process Finished ---");
}


void uploadQueuedPhotos() {
  if (!sdCardPresent || !Firebase.ready()) return;
  
  File root = SD_MMC.open("/");
  if(!root){
      Serial.println("ERROR: Failed to open SD card root directory");
      return;
  }

  File file = root.openNextFile();
  if (file && String(file.name()).startsWith("/photo_")) {
    String path = file.name();
    Serial.printf("Found queued photo on SD card: %s\n", path.c_str());
    
    String tsString = path.substring(path.indexOf('_') + 1, path.lastIndexOf('.'));
    time_t timestamp = atol(tsString.c_str());

    size_t fileSize = file.size();
    uint8_t *buffer = (uint8_t *)malloc(fileSize);
    if (!buffer) {
        Serial.println("ERROR: Failed to allocate memory for photo buffer");
        file.close();
        root.close();
        return;
    }

    file.read(buffer, fileSize);
    file.close();

    if (uploadToFirebase(buffer, fileSize, timestamp)) {
      Serial.printf("Successfully uploaded %s. Deleting file from SD card.\n", path.c_str());
      SD_MMC.remove(path.c_str());
      updateFirebaseStatus();
    } else {
      Serial.printf("Failed to upload %s. Will retry later.\n", path.c_str());
    }
    free(buffer);
  }
  
  root.close();
}


// --- Connectivity and Helper Functions ---

bool connectToWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi...");
  
  unsigned long startAttemptTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < MAX_WIFI_CONNECT_TIME) {
    Serial.print(".");
    delay(WIFI_RETRY_DELAY);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    return true;
  } else {
    Serial.println("\nFailed to connect to WiFi within the timeout period.");
    return false;
  }
}

void initNTP() {
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  unsigned long startTime = millis();
  while (!time(nullptr) && (millis() - startTime < 5000)) {
    Serial.print(".");
    delay(500);
  }
  
  time_t now = time(nullptr);
  if (now > 1000000000) {
    Serial.println("\nNTP time synchronized successfully!");
    ntpInitialized = true;
  } else {
    Serial.println("\nFailed to set time using NTP.");
    ntpInitialized = false;
  }
}

void updateFirebaseStatus() {
  if (Firebase.ready() && WiFi.status() == WL_CONNECTED) {
    FirebaseJson json;
    float intervalHours = interval / (60.0 * 60.0 * 1000.0);
    json.set("flashState", flashState ? "ON" : "OFF");
    json.set("photoIntervalHours", String(intervalHours, 1));
    json.set("lastUpdate", getFormattedDate(0)); 
    json.set("ipAddress", WiFi.localIP().toString());

    if (Firebase.RTDB.setJSON(&fbdo, FB_STATUS_PATH, &json)) {
      if(DEBUG_FIREBASE_OPERATIONS) Serial.println("Status update successful.");
    } else {
      if(DEBUG_FIREBASE_OPERATIONS) Serial.printf("Status update failed: %s\n", fbdo.errorReason().c_str());
    }
  }
}

String getFormattedDate(unsigned long dummy) {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo)) {
    return "Time unavailable";
  }
  char dateStr[30];
  strftime(dateStr, sizeof(dateStr), "%b %d, %Y %H:%M:%S", &timeinfo);
  return String(dateStr);
}

String base64Encode(const uint8_t* data, size_t length) {
  static const char* encoding_table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  size_t output_length = 4 * ((length + 2) / 3);
  char* encoded_data = new char[output_length + 1];
  if (encoded_data == NULL) return "";
  
  for (size_t i = 0, j = 0; i < length;) {
    uint32_t octet_a = i < length ? data[i++] : 0;
    uint32_t octet_b = i < length ? data[i++] : 0;
    uint32_t octet_c = i < length ? data[i++] : 0;
    uint32_t triple = (octet_a << 0x10) + (octet_b << 0x08) + octet_c;
    encoded_data[j++] = encoding_table[(triple >> 3 * 6) & 0x3F];
    encoded_data[j++] = encoding_table[(triple >> 2 * 6) & 0x3F];
    encoded_data[j++] = encoding_table[(triple >> 1 * 6) & 0x3F];
    encoded_data[j++] = encoding_table[(triple >> 0 * 6) & 0x3F];
  }
  
  for (size_t i = 0; i < (3 - length % 3) % 3; i++) {
    encoded_data[output_length - 1 - i] = '=';
  }
  
  encoded_data[output_length] = '\0';
  String result = String(encoded_data);
  delete[] encoded_data;
  return result;
}

// --- Firebase Command Handling ---

void processFirebaseCommand(String commandType, String commandData) {
  Serial.println("Processing command: " + commandType + ", data: " + commandData);
  if (commandType == "takePhoto") {
    sendPhoto = true;
    Serial.println("Command: Take photo");
  } 
  else if (commandType == "toggleFlash") {
    flashState = !flashState;
    digitalWrite(FLASH_LED_PIN, flashState);
    saveSettings(); // *** STABILITY: Save new flash state permanently ***
    Serial.println("Command: Toggle flash to " + String(flashState ? "ON" : "OFF"));
    updateFirebaseStatus();
  } 
  else if (commandType == "setInterval") {
    if (commandData.length() > 0) {
      float hours = commandData.toFloat();
      if (hours > 0) {
        unsigned long newInterval = hours * 60 * 60 * 1000;
        if (newInterval < MIN_INTERVAL) newInterval = MIN_INTERVAL;
        if (newInterval > MAX_INTERVAL) newInterval = MAX_INTERVAL;
        interval = newInterval;
        saveSettings(); // *** STABILITY: Save new interval permanently ***
        Serial.println("Command: Set interval to " + String(hours) + " hours");
        updateFirebaseStatus();
      }
    }
  }
}

bool checkFirebaseCommands() {
  if (!Firebase.ready() || WiFi.status() != WL_CONNECTED) return false;
  if (Firebase.RTDB.getJSON(&fbdo, FB_COMMANDS_PATH)) {
    if (fbdo.dataType() == "json") {
      FirebaseJson *json = fbdo.to<FirebaseJson *>();
      FirebaseJsonData result;
      
      json->get(result, "id");
      if (result.success) {
        String commandId = result.to<String>();
        if (commandId != lastProcessedCommandId) {
          json->get(result, "type");
          if (result.success) {
            String commandType = result.to<String>();
            String commandData = "";
            json->get(result, "data");
            if (result.success) commandData = result.to<String>();
            
            processFirebaseCommand(commandType, commandData);
            lastProcessedCommandId = commandId;
            return true;
          }
        }
      }
    }
  }
  return false;
}

// *** STABILITY: Functions to save and load settings ***
void loadSettings() {
  preferences.begin("espcam-settings", false);
  // Load interval, if it doesn't exist, keep the default
  interval = preferences.getULong("interval", interval); 
  // Load flash state, if it doesn't exist, keep the default
  flashState = preferences.getBool("flashState", flashState);
  preferences.end();

  Serial.println("--- Loaded Settings ---");
  Serial.printf("Interval: %lu ms\n", interval);
  Serial.printf("Flash State: %s\n", flashState ? "ON" : "OFF");
  Serial.println("-----------------------");
}

void saveSettings() {
  preferences.begin("espcam-settings", false);
  preferences.putULong("interval", interval);
  preferences.putBool("flashState", flashState);
  preferences.end();
  Serial.println("SUCCESS: Settings saved to flash memory.");
}

// --- Main Setup and Loop ---

void setup(){
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable brownout detector
  Serial.begin(115200);
  Serial.println("\n--- ESP32-CAM Firebase & SD Card Logger (Stable Version) ---");
  
  loadSettings(); // *** STABILITY: Load saved settings on boot ***

  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, flashState);
  
  configInitCamera();
  
  Serial.println("Initializing SD Card...");
  if(!SD_MMC.begin()){
    Serial.println("WARNING: SD Card Mount Failed. Photos will not be saved offline.");
    sdCardPresent = false;
  } else {
    sdCardPresent = (SD_MMC.cardType() != CARD_NONE);
    if(sdCardPresent) Serial.println("SUCCESS: SD Card initialized.");
    else Serial.println("WARNING: No SD card attached.");
  }

  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, flashState);

  if(connectToWiFi()){
    initNTP();
    config.api_key = FIREBASE_API_KEY;
    config.database_url = FIREBASE_DATABASE_URL;
    auth.user.email = FIREBASE_USER_EMAIL;
    auth.user.password = FIREBASE_USER_PASSWORD;
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);
    
    Serial.println("Waiting for Firebase connection...");
    unsigned long startTime = millis();
    while (!Firebase.ready() && (millis() - startTime < 10000)) {
      Serial.print(".");
      delay(500);
    }
    Serial.println();
    
    if (Firebase.ready()) {
      Serial.println("SUCCESS: Firebase connected.");
      updateFirebaseStatus();
      uploadQueuedPhotos();
    } else {
      Serial.println("ERROR: Failed to connect to Firebase.");
    }
  }
}

void loop() {
  unsigned long currentMillis = millis();
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi Disconnected. Attempting to reconnect...");
    if (connectToWiFi()) {
      Serial.println("WiFi Reconnected.");
      Firebase.begin(&config, &auth);
      if (!ntpInitialized) initNTP();
    } else {
      Serial.println("Reconnect failed. Will retry in 5s.");
      delay(5000);
      return;
    }
  }

  if (Firebase.ready()) {
    static unsigned long lastFirebaseCheck = 0;
    if (currentMillis - lastFirebaseCheck >= 2000) {
      lastFirebaseCheck = currentMillis;
      checkFirebaseCommands();
    }
    
    static unsigned long lastStatusUpdate = 0;
    if (currentMillis - lastStatusUpdate >= 60000) {
      lastStatusUpdate = currentMillis;
      updateFirebaseStatus();
    }
    
    if(sdCardPresent) {
      static unsigned long lastSDCheck = 0;
      if (currentMillis - lastSDCheck >= 10000) {
        lastSDCheck = currentMillis;
        uploadQueuedPhotos();
      }
    }
  }
  
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;
    Serial.println("Interval reached. Triggering photo capture...");
    sendPhoto = true;
  }

  if (sendPhoto) {
    takeAndProcessPhoto();
    sendPhoto = false;
  }

  delay(10);
}