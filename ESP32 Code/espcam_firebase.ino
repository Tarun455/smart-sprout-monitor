#include <Arduino.h>
#include <WiFi.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "esp_camera.h"
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include "time.h"

// Debug flags - set to false to reduce serial output
#define DEBUG_FIREBASE_CHECKS false
#define DEBUG_FIREBASE_OPERATIONS true

const char* ssid = "your_wifi_ssid";
const char* password = "your_wifi_password";

// NTP server settings
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800; // India timezone: UTC+5:30 (5.5 hours * 3600 seconds = 19800)
const int daylightOffset_sec = 0; // No daylight saving time in India

#define FLASH_LED_PIN 4
bool flashState = LOW;

// Wi-Fi connection parameters
#define WIFI_RETRY_DELAY 1000 // 1 seconds between retries
#define MAX_WIFI_CONNECT_TIME 480000 // 8 minutes (480 seconds)

// Timer variables for automatic photo interval
unsigned long previousMillis = 0;
// Default interval is 12 hours
unsigned long interval = 12 * 60 * 60 * 1000; // in milliseconds
// Minimum interval allowed (15 minutes)
const unsigned long MIN_INTERVAL = 15 * 60 * 1000;
// Maximum interval allowed (48 hours)
const unsigned long MAX_INTERVAL = 48 * 60 * 60 * 1000;

//CAMERA_MODEL_AI_THINKER
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

// Firebase configuration
#define FIREBASE_API_KEY "your_firebase_api_key"
#define FIREBASE_DATABASE_URL "your_firebase_database_url"

#define FIREBASE_USER_EMAIL "your_email@example.com"
#define FIREBASE_USER_PASSWORD "your_password"

// Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Firebase paths
#define FB_COMMANDS_PATH "/commands"
#define FB_STATUS_PATH "/status"
#define FB_PHOTOS_PATH "/photos"

// Command flags and IDs to track processed commands
String lastProcessedCommandId = "";
bool sendPhoto = false;
bool ntpInitialized = false;

// Function to initialize NTP
void initNTP() {
  // Configure time with NTP server
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  
  // Wait up to 5 seconds for time synchronization
  unsigned long startTime = millis();
  while (!time(nullptr) && (millis() - startTime < 5000)) {
    Serial.print(".");
    delay(500);
  }
  
  // Check if time was successfully set
  time_t now = time(nullptr);
  if (now > 1000000000) { // Sanity check (1000000000 is roughly year 2001)
    Serial.println("NTP time synchronized successfully!");
    struct tm timeinfo;
    if(getLocalTime(&timeinfo)){
      Serial.println("Current time: " + getFormattedDate(0)); // 0 just to call the function that gets real time
      ntpInitialized = true;
    }
  } else {
    Serial.println("Failed to set time using NTP.");
    ntpInitialized = false;
  }
}

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

  //init with high specs to pre-allocate larger buffers
  if(psramFound()){
    config.frame_size = FRAMESIZE_UXGA;
    config.jpeg_quality = 5;  //0-63 lower number means higher quality
    config.fb_count = 1;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 5;  //0-63 lower number means higher quality
    config.fb_count = 1;
  }
  
  // camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    delay(1000);
    ESP.restart();
  }
}

bool connectToWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  unsigned long startAttemptTime = millis();

  while (WiFi.status() != WL_CONNECTED && 
         millis() - startAttemptTime < MAX_WIFI_CONNECT_TIME) {
    Serial.print(".");
    delay(WIFI_RETRY_DELAY);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    return true;
  } else {
    Serial.println("\nFailed to connect to WiFi within the allocated time.");
    return false;
  }
}

void updateFirebaseStatus() {
  if (Firebase.ready() && WiFi.status() == WL_CONNECTED) {
    FirebaseJson json;
    float intervalHours = interval / (60.0 * 60.0 * 1000.0);
    json.set("flashState", flashState ? "ON" : "OFF");
    json.set("photoIntervalHours", String(intervalHours, 1));
    json.set("lastUpdate", String(millis())); 
    json.set("ipAddress", WiFi.localIP().toString());
    json.set("lastPhotoTime", millis());

    Serial.printf("Updating Firebase status at %s...\n", FB_STATUS_PATH);
    if (Firebase.RTDB.setJSON(&fbdo, FB_STATUS_PATH, &json)) {
      Serial.println("Status update successful.");
    } else {
      Serial.print("Status update failed: ");
      Serial.println(fbdo.errorReason().c_str());
    }
  } else {
    Serial.println("Cannot update Firebase status: Firebase not ready or WiFi disconnected.");
  }
}

// Function to take a photo and save it directly to Firebase
bool takePhotoAndSaveToFirebase() {
  // Save flash state before we modify it
  bool previousFlashState = flashState;
  
  // Always turn on flash for better photo quality
  digitalWrite(FLASH_LED_PIN, HIGH);
  delay(200);  // Brief delay to let flash take effect
  
  // Capture image
  camera_fb_t * fb = NULL;
  
  // Dispose first picture because it may have poor quality
  fb = esp_camera_fb_get();
  esp_camera_fb_return(fb);
  
  // Take a new photo
  fb = NULL;  
  fb = esp_camera_fb_get();  
  if(!fb) {
    Serial.println("Camera capture failed");
    digitalWrite(FLASH_LED_PIN, previousFlashState); // Restore flash
    return false;
  }
  
  Serial.println("Photo captured, size: " + String(fb->len) + " bytes");
  
  // Save to Firebase
  if (Firebase.ready() && WiFi.status() == WL_CONNECTED) {
    // Generate a unique photo ID
    String photoId = "photo_" + String(millis());
    
    // Get current time as Unix timestamp (seconds since Jan 1, 1970)
    time_t now = time(nullptr);
    Serial.println("Current Unix timestamp (seconds): " + String(now));
    
    // Convert to milliseconds for JavaScript timestamp
    unsigned long jsTimestamp = now * 1000UL;
    Serial.println("JavaScript timestamp (milliseconds): " + String(jsTimestamp));
    
    // Get a human-readable formatted date string
    String formattedDate = getFormattedDate(0);
    Serial.println("Formatted date: " + formattedDate);
    
    // Base64 encode image data
    String imageBase64 = base64Encode(fb->buf, fb->len);
    
    // Create Firebase photo entry with image data
    FirebaseJson json;
    json.set("timestamp", jsTimestamp);  // Store as a number, not a string
    json.set("imageData", imageBase64);
    json.set("caption", formattedDate);  // Just use the formatted date as the caption
    
    String photoPath = String(FB_PHOTOS_PATH) + "/" + photoId;
    Serial.println("Saving photo to Firebase at: " + photoPath);
    
    if (Firebase.RTDB.setJSON(&fbdo, photoPath.c_str(), &json)) {
      Serial.println("Photo saved to Firebase successfully");
      
      // Verify what was saved (debugging)
      if (Firebase.RTDB.getJSON(&fbdo, photoPath.c_str())) {
        Serial.println("Verified saved data: " + fbdo.to<String>());
      }
      
      // Release camera buffer
      esp_camera_fb_return(fb);
      
      // Restore flash state
      digitalWrite(FLASH_LED_PIN, previousFlashState);
      Serial.println("Flash restored to previous state: " + String(previousFlashState ? "ON" : "OFF"));
      
      return true;
    } else {
      Serial.println("Failed to save photo to Firebase: " + fbdo.errorReason());
    }
  } else {
    Serial.println("Firebase not ready or WiFi disconnected. Cannot save photo.");
  }
  
  // Release camera buffer
  esp_camera_fb_return(fb);
  
  // Restore flash state
  digitalWrite(FLASH_LED_PIN, previousFlashState);
  Serial.println("Flash restored to previous state: " + String(previousFlashState ? "ON" : "OFF"));
  
  return false;
}

// Helper function to format the current date and time as a string
String getFormattedDate(unsigned long dummy) {
  struct tm timeinfo;
  char dateStr[30];
  
  if(!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    // Fallback to uptime if NTP sync fails
    if (!ntpInitialized) {
      // Return the uptime format as a fallback
      unsigned long seconds = millis() / 1000;
      unsigned long minutes = seconds / 60;
      unsigned long hours = minutes / 60;
      unsigned long days = hours / 24;
      
      hours %= 24;
      minutes %= 60;
      seconds %= 60;
      
      String uptimeFormat = "Day " + String(days) + " - ";
      
      if (hours < 10) uptimeFormat += "0";
      uptimeFormat += String(hours) + ":";
      
      if (minutes < 10) uptimeFormat += "0";
      uptimeFormat += String(minutes) + ":";
      
      if (seconds < 10) uptimeFormat += "0";
      uptimeFormat += String(seconds) + " uptime";
      
      return uptimeFormat;
    }
    return "Time unavailable";
  }
  
  // Format: "Jan 15, 2023 14:30:45"
  strftime(dateStr, sizeof(dateStr), "%b %d, %Y %H:%M:%S", &timeinfo);
  return String(dateStr);
}

// Base64 encode function
String base64Encode(const uint8_t* data, size_t length) {
  static const char* encoding_table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  size_t output_length = 4 * ((length + 2) / 3);
  char* encoded_data = new char[output_length + 1];
  
  if (encoded_data == NULL) {
    return "";
  }
  
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
  
  // Add padding
  for (size_t i = 0; i < (3 - length % 3) % 3; i++) {
    encoded_data[output_length - 1 - i] = '=';
  }
  
  encoded_data[output_length] = '\0';
  String result = String(encoded_data);
  delete[] encoded_data;
  
  return result;
}

void setup(){
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); 
  // Init Serial Monitor
  Serial.begin(115200);
  Serial.println();
  
  // Set LED Flash as output
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, flashState);
  
  // Config and init the camera
  configInitCamera();
  
  // Connect to Wi-Fi
  WiFi.mode(WIFI_STA);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  // Wait for connection
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  
  Serial.println();
  Serial.print("ESP32-CAM IP Address: ");
  Serial.println(WiFi.localIP());
  
  // Initialize NTP
  Serial.println("Initializing NTP time...");
  initNTP();

  // Initialize Firebase
  Serial.println("Initializing Firebase...");
  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DATABASE_URL;
  
  // Firebase authentication
  auth.user.email = FIREBASE_USER_EMAIL;
  auth.user.password = FIREBASE_USER_PASSWORD;
  
  // Initialize the library with the Firebase authen and config
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  // Wait for Firebase to be ready
  Serial.println("Waiting for Firebase connection...");
  unsigned long startTime = millis();
  while (!Firebase.ready() && (millis() - startTime < 10000)) {
    Serial.print(".");
    delay(500);
  }
  Serial.println();
  
  if (Firebase.ready()) {
    Serial.println("Firebase connected successfully!");
    // Send initial status to Firebase
    updateFirebaseStatus();
  } else {
    Serial.println("Failed to connect to Firebase after timeout. Will retry in the main loop.");
  }
}

// Function to check Firebase for new commands
bool checkFirebaseCommands() {
  if (!Firebase.ready() || WiFi.status() != WL_CONNECTED) {
    return false;
  }
  
  // Only print when debug is enabled
  if (DEBUG_FIREBASE_CHECKS) {
    Serial.println("Checking Firebase for commands...");
  }
  
  if (Firebase.RTDB.getJSON(&fbdo, FB_COMMANDS_PATH)) {
    if (fbdo.dataType() == "json") {
      FirebaseJson *json = fbdo.to<FirebaseJson *>();
      FirebaseJsonData result;
      
      // Get command ID first to avoid processing the same command multiple times
      json->get(result, "id");
      if (result.success) {
        String commandId = result.to<String>();
        if (commandId == lastProcessedCommandId) {
          // Already processed this command
          return false;
        }
        
        // Get command type
        json->get(result, "type");
        if (result.success) {
          String commandType = result.to<String>();
          
          // Print when a new command is found
          if (DEBUG_FIREBASE_OPERATIONS) {
            Serial.println("New command found with ID: " + commandId);
          }
          
          // Get command data if present
          String commandData = "";
          json->get(result, "data");
          if (result.success) {
            commandData = result.to<String>();
          }
          
          // Process command
          processFirebaseCommand(commandType, commandData);
          
          // Save last processed command ID
          lastProcessedCommandId = commandId;
          
          // Acknowledge command processing
          FirebaseJson ackJson;
          ackJson.set("status", "processed");
          ackJson.set("timestamp", String(millis())); 
          
          // Use String object to handle concatenation
          String lastProcessedPath = String(FB_COMMANDS_PATH) + "/lastProcessed";
          Firebase.RTDB.setJSON(&fbdo, lastProcessedPath.c_str(), &ackJson);
          
          if (DEBUG_FIREBASE_OPERATIONS) {
            Serial.println("Command processed and acknowledged");
          }
          
          return true;
        }
      }
    }
  } else {
    // Only log errors
    if (DEBUG_FIREBASE_OPERATIONS) {
      Serial.println("Failed to get Firebase commands: " + fbdo.errorReason());
    }
  }
  
  return false;
}

// Function to process Firebase commands
void processFirebaseCommand(String commandType, String commandData) {
  Serial.println("Processing command: " + commandType + ", data: " + commandData);
  
  if (commandType == "takePhoto") {
    // Trigger photo taking
    sendPhoto = true;
    Serial.println("Command: Take photo");
  } 
  else if (commandType == "toggleFlash") {
    // Toggle flash state
    flashState = !flashState;
    digitalWrite(FLASH_LED_PIN, flashState);
    Serial.println("Command: Toggle flash to " + String(flashState ? "ON" : "OFF"));
    updateFirebaseStatus();
  } 
  else if (commandType == "setInterval") {
    // Change automatic photo interval (data is in hours)
    if (commandData.length() > 0) {
      float hours = commandData.toFloat();
      if (hours > 0) {
        // Convert hours to milliseconds
        unsigned long newInterval = hours * 60 * 60 * 1000;
        
        // Enforce min/max limits
        if (newInterval < MIN_INTERVAL) {
          newInterval = MIN_INTERVAL;
          Serial.println("Interval too short, setting to minimum: " + String(MIN_INTERVAL / (60.0 * 60.0 * 1000.0)) + " hours");
        } 
        else if (newInterval > MAX_INTERVAL) {
          newInterval = MAX_INTERVAL;
          Serial.println("Interval too long, setting to maximum: " + String(MAX_INTERVAL / (60.0 * 60.0 * 1000.0)) + " hours");
        }
        
        interval = newInterval;
        Serial.println("Command: Set interval to " + String(hours) + " hours");
        updateFirebaseStatus();
      }
    }
  }
}

void loop() {
  unsigned long currentMillis = millis();
  
  // Check WiFi status and reconnect if necessary
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi Disconnected. Attempting to reconnect...");
    if (connectToWiFi()) {
      Serial.println("WiFi Reconnected.");
      // Re-initialize Firebase connection state if necessary
      Firebase.begin(&config, &auth); // Re-assert config and auth
      
      // Re-sync NTP time after reconnection
      if (!ntpInitialized) {
        initNTP();
      }
    } else {
      Serial.println("Reconnect failed. Will retry later.");
      delay(WIFI_RETRY_DELAY); // Wait before next loop iteration
      return; // Skip rest of loop if no WiFi
    }
  }

  // Try to update Firebase status periodically
  static unsigned long lastStatusUpdate = 0;
  const unsigned long statusUpdateInterval = 60000; // Update status every minute
  if (currentMillis - lastStatusUpdate >= statusUpdateInterval) {
    lastStatusUpdate = currentMillis;
    
    if (!Firebase.ready()) {
      Serial.println("Firebase not ready. Attempting to reinitialize...");
      Firebase.begin(&config, &auth);
    } else {
      updateFirebaseStatus();
    }
  }
  
  // Re-sync NTP periodically (every hour)
  static unsigned long lastNTPSync = 0;
  const unsigned long ntpSyncInterval = 3600000; // 1 hour in milliseconds
  if (currentMillis - lastNTPSync >= ntpSyncInterval) {
    lastNTPSync = currentMillis;
    Serial.println("Performing periodic NTP sync...");
    initNTP();
  }

  // Check Firebase for new commands periodically
  static unsigned long lastFirebaseCheck = 0;
  const unsigned long firebaseCheckInterval = 1000; // 1 second
  if (currentMillis - lastFirebaseCheck >= firebaseCheckInterval) {
    lastFirebaseCheck = currentMillis;
    
    if (Firebase.ready()) {
      // Call the function but don't log every check
      checkFirebaseCommands();
    }
  }

  // Handle automatic photo taking interval
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis; // Reset the timer
    Serial.println("Interval reached. Taking photo...");
    sendPhoto = true; // Set flag to take photo
  }

  // If a photo needs to be captured
  if (sendPhoto) {
    Serial.println("Taking photo and uploading to Firebase...");
    bool success = takePhotoAndSaveToFirebase();
    Serial.println(success ? "Photo upload successful" : "Photo upload failed");
    sendPhoto = false;   // Reset the flag
    updateFirebaseStatus(); // Update status after taking photo
  }

  // Small delay to prevent busy-waiting
  delay(10);
}