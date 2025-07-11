/*
 * SmartSprout Greenhouse Monitoring System
 * ESP32 Firebase Integration
 * 
 * This code connects an ESP32 to Firebase Realtime Database to:
 * - Send sensor data (soil moisture, temperature, humidity, CO2)
 * - Receive control commands (pump, fan, light control)
 * - Maintain automatic control based on thresholds

 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <Wire.h>
#include <DHT.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include <ArduinoJson.h>

// For MQ135 sensor
#include <MQ135.h>

// Include the credentials file
// Create a file named credentials.h with the following content:
/*
  const char* WIFI_SSID = "your_ssid";
  const char* WIFI_PASSWORD = "your_password";
  const char* FIREBASE_API_KEY = "your_firebase_api_key";
  const char* FIREBASE_DATABASE_URL = "your_firebase_database_url";
*/

// Define your credentials here or use a credentials.h file
#define WIFI_SSID "your_wifi_ssid"
#define WIFI_PASSWORD "your_wifi_password"
#define FIREBASE_API_KEY "your_firebase_api_key"
#define FIREBASE_DATABASE_URL "your_firebase_database_url"

#define FIREBASE_USER_EMAIL "your_email@example.com";
#define FIREBASE_USER_PASSWORD "your_password";

// WiFi credentials
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;

// Wi-Fi connection parameters
#define WIFI_RECONNECT_INTERVAL 30000 // 30 seconds between reconnection attempts
#define WIFI_RETRY_DELAY 5000         // 5 seconds delay between connection retries
#define MAX_WIFI_RETRIES 10           // Maximum number of connection retries before restarting

// Firebase project API Key and RTDB URL
#define API_KEY FIREBASE_API_KEY
#define DATABASE_URL FIREBASE_DATABASE_URL

// Define Firebase Data object
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
FirebaseJson json;

// Pin Definitions
const int SOIL_MOISTURE_PINS[] = {32, 33, 34, 35};  // Soil moisture sensor pins
const int WATER_PUMP_PINS[] = {16, 17};             // Water pump relay pins
const int DHT_PINS[] = {18, 19};                    // DHT sensor pins
const int MQ_PIN = 36;                              // MQ135 sensor analog pin
const int FAN_PIN = 21;                             // Fan relay pin
const int LIGHT_PIN = 27;                           // Light relay pin

// Control mode flag
bool automaticMode = true;  // Default to automatic mode

// Threshold values (global variables)
int moistureThreshold = 1500;
float tempThreshold = 28.0;
int co2Threshold = 800;     // ppm threshold for CO₂

// Variables for new time-based light schedule
String lightOnTimeStr = "07:00:00";
String lightOffTimeStr = "21:00:00";
int lightOnHour = 7;    // Default light on hour
int lightOnMinute = 0;  // Default light on minute
int lightOffHour = 21;  // Default light off hour
int lightOffMinute = 0; // Default light off minute

// Timer variables for fan override
unsigned long lastFanTimer = 0;
const unsigned long FAN_INTERVAL = 3600000; // 1 hour interval (in milliseconds)
const unsigned long FAN_RUNTIME = 60000;    // Fan run time of 1 minute (in milliseconds)
bool fanTimerActive = false;
unsigned long fanTimerStart = 0;
bool fanSensorActivated = false;  // Track if fan is on due to sensor readings

// Hysteresis values to prevent rapid relay switching
const int MOISTURE_HYSTERESIS = 100;  // Hysteresis for moisture readings
const float TEMP_HYSTERESIS = 0.5;    // Hysteresis for temperature readings (0.5°C)
const int CO2_HYSTERESIS = 50;        // Hysteresis for CO2 readings (50 ppm)

// Timer variables
unsigned long lastFirebaseUpdate = 0;
const unsigned long FIREBASE_UPDATE_INTERVAL = 5000; // Update Firebase every 5 seconds

unsigned long lastStatusUpdate = 0;
const unsigned long STATUS_UPDATE_INTERVAL = 15000; // Update status every 15 seconds (more frequent)

unsigned long lastHistoryUpdate = 0;
const unsigned long HISTORY_UPDATE_INTERVAL = 60000; // Update history every 60 seconds 

unsigned long lastSensorRead = 0;
const unsigned long SENSOR_READ_INTERVAL = 2000; // Read sensors every 2 seconds

unsigned long lastWifiCheck = 0;
const unsigned long WIFI_CHECK_INTERVAL = 10000; // Check WiFi every 10 seconds

// Sensor object instantiation
DHT dht1(DHT_PINS[0], DHT22);
DHT dht2(DHT_PINS[1], DHT22);

// Instantiate the MQ135 sensor object
MQ135 mq135Sensor(MQ_PIN);

// NTP Client
WiFiUDP udp;
NTPClient timeClient(udp, "pool.ntp.org");

// Firebase connection status
bool firebaseConnected = false;

// Global sensor variables (read once, used multiple times)
int moistureValues[4] = {0, 0, 0, 0};
float tempValues[2] = {0.0, 0.0};
float humidityValues[2] = {0.0, 0.0};
float avgTemp = 0.0;
float avgHumidity = 0.0;
float co2ppm = 0.0;

// Last state variables to prevent redundant Firebase updates
bool lastPump1State = false;
bool lastPump2State = false;
bool lastFanState = false;
bool lastLightState = false;
bool lastAutomaticMode = true;
int lastMoistureThreshold = 1500;
float lastTempThreshold = 28.0;
int lastCo2Threshold = 800;

// WiFi reconnection variables
static unsigned long reconnectStartTime = 0;
static int reconnectAttempts = 0;
static bool wasDisconnected = false;

// Startup mode variables
unsigned long startupTime = 0;
const unsigned long STARTUP_MANUAL_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds
bool startupModeComplete = false;

// System memory tracking
unsigned long lowestHeap = UINT32_MAX; // Start with max value
const unsigned long LOW_MEMORY_THRESHOLD = 40000; // 40KB threshold for low memory warning
const unsigned long CRITICAL_MEMORY_THRESHOLD = 20000; // 20KB threshold for critical memory warning

// Parse ISO time string to get hour and minute
void parseTimeString(const String &timeString, int &hour, int &minute) {
  // Format can be either HH:MM:SS or full ISO string
  // For ISO string like "2023-12-01T07:00:00.000Z", extract the time part
  
  int tPos = timeString.indexOf('T');
  String timePart = timeString;
  
  if (tPos > 0) {
    // Extract only time part from ISO string
    timePart = timeString.substring(tPos + 1);
  }
  
  // Now extract hour and minute from HH:MM:SS
  int colonPos = timePart.indexOf(':');
  if (colonPos > 0) {
    hour = timePart.substring(0, colonPos).toInt();
    minute = timePart.substring(colonPos + 1, colonPos + 3).toInt();
  }
}

// Function to control lights based on schedule
void controlLights() {
  if (!automaticMode) return;
  
  // Get current time
  int currentHour = timeClient.getHours();
  int currentMinute = timeClient.getMinutes();
  int currentTimeMinutes = currentHour * 60 + currentMinute;
  
  // Calculate schedule minutes
  int lightOnTimeMinutes = lightOnHour * 60 + lightOnMinute;
  int lightOffTimeMinutes = lightOffHour * 60 + lightOffMinute;
  
  bool lightsNeeded = false;
  static bool lightsAreOn = false;
  
  if (lightOnTimeMinutes < lightOffTimeMinutes) {
    // Normal case (e.g., ON at 7:00, OFF at 21:00)
    lightsNeeded = (currentTimeMinutes >= lightOnTimeMinutes && currentTimeMinutes < lightOffTimeMinutes);
  } else {
    // Overnight case (e.g., ON at 21:00, OFF at 7:00)
    lightsNeeded = (currentTimeMinutes >= lightOnTimeMinutes || currentTimeMinutes < lightOffTimeMinutes);
  }
  
  // Only update if state changes
  if (lightsNeeded != lightsAreOn) {
    digitalWrite(LIGHT_PIN, lightsNeeded ? LOW : HIGH);
    lightsAreOn = lightsNeeded;
    Serial.println("Lights turned " + String(lightsNeeded ? "ON" : "OFF") + " by automatic schedule");
  }
}

// Returns a status string including sensor readings, relay states, and current thresholds.
String getStatus() {
  String status = "🌿 Greenhouse(SmartSprout) Status\n";
  status += "══════════════════════\n\n";
  
  status += "📊 Control Mode: " + String(automaticMode ? "🤖 Automatic" : "👨‍💼 Manual") + "\n";
  status += "⏰ Time: " + String(timeClient.getFormattedTime()) + "\n";
  status += "🪴 Free Heap: " + String(ESP.getFreeHeap()) + " bytes\n"; 
  status += "══════════════════════\n\n";
  
  // Soil Moisture readings
  status += "🌱 Soil Moisture\n";
  status += "──────────────\n";
  for (int i = 0; i < 4; i++) {
    status += "Section " + String(i+1) + ": " + String(moistureValues[i]) + 
              " (" + (moistureValues[i] > moistureThreshold ? "Dry" : "Wet") + ")\n";
  }
  status += "\n";

  // Environmental Readings
  status += "🌡️ Environmental Readings\n";
  status += "──────────────\n";
  status += "Temperature: " + String(avgTemp, 1) + "°C (";
  status += String(tempValues[0], 1) + "°C | " + String(tempValues[1], 1) + "°C) [Threshold: " + String(tempThreshold, 1) + "°C]\n";
  status += "Humidity: " + String(avgHumidity, 1) + "% (";
  status += String(humidityValues[0], 1) + "% | " + String(humidityValues[1], 1) + "%)\n";
  status += "CO₂ Level: " + String(co2ppm, 1) + " ppm [Threshold: " + String(co2Threshold) + "]\n\n";
  
  // Relay Status (active low: LOW means ON, HIGH means OFF)
  status += "⚡ Relay Status\n";
  status += "──────────────\n";
  status += "Pump 1: " + String(digitalRead(WATER_PUMP_PINS[0]) == LOW ? "🟢 ON" : "🔴 OFF") + "\n";
  status += "Pump 2: " + String(digitalRead(WATER_PUMP_PINS[1]) == LOW ? "🟢 ON" : "🔴 OFF") + "\n";
  status += "Fan: "    + String(digitalRead(FAN_PIN)           == LOW ? "🟢 ON" : "🔴 OFF") + "\n";
  status += "Lights: " + String(digitalRead(LIGHT_PIN)         == LOW ? "🟢 ON" : "🔴 OFF") + "\n";
  status += "══════════════════════\n";
  status += "Light Schedule: ON at " + String(lightOnHour) + ":00, OFF at " + String(lightOffHour) + ":00\n";
  
  return status;
}

// Read all sensor values and update global variables
void readSensors() {
  // Read soil moisture sensors
  for (int i = 0; i < 4; i++) {
    moistureValues[i] = analogRead(SOIL_MOISTURE_PINS[i]);
  }
  
  // Read temperature and humidity from both sensors
  // First sensor (DHT1)
  float t1 = dht1.readTemperature();
  float h1 = dht1.readHumidity();
  
  // Second sensor (DHT2)
  float t2 = dht2.readTemperature();
  float h2 = dht2.readHumidity();
  
  // Only update if readings are valid (not NaN)
  if (!isnan(t1)) tempValues[0] = t1;
  if (!isnan(h1)) humidityValues[0] = h1;
  
  if (!isnan(t2)) tempValues[1] = t2;
  if (!isnan(h2)) humidityValues[1] = h2;
  
  // Calculate averages
  avgTemp = (tempValues[0] + tempValues[1]) / 2.0;
  avgHumidity = (humidityValues[0] + humidityValues[1]) / 2.0;
  
  // Get CO₂ reading with temperature and humidity correction
  float rawCO2 = mq135Sensor.getCorrectedPPM(avgTemp, avgHumidity);
  
  // Check if CO2 reading is NaN, replace with 0 if it is
  if (isnan(rawCO2)) {
    co2ppm = 0.0;
  } else {
    co2ppm = rawCO2;
  }
}

// Controls water pumps based on soil moisture, threshold, and hysteresis
void controlWaterPumps() {
  if (!automaticMode) return;
  
  // Pump 1 controls sections 1 and 2
  bool pump1Needed = false;
  static bool pump1IsOn = false;
  
  // Check if any section needs water
  if (pump1IsOn) {
    // Apply hysteresis when turning OFF
    pump1Needed = (moistureValues[0] > (moistureThreshold - MOISTURE_HYSTERESIS)) || 
                  (moistureValues[1] > (moistureThreshold - MOISTURE_HYSTERESIS));
  } else {
    // Apply hysteresis when turning ON
    pump1Needed = (moistureValues[0] > (moistureThreshold + MOISTURE_HYSTERESIS)) || 
                  (moistureValues[1] > (moistureThreshold + MOISTURE_HYSTERESIS));
  }
  
  // Only update if state changes
  if (pump1IsOn != pump1Needed) {
    digitalWrite(WATER_PUMP_PINS[0], pump1Needed ? LOW : HIGH); // LOW turns pump ON
    pump1IsOn = pump1Needed;
    Serial.println("\n=== Automatic Control Update (Pump 1) ===");
    Serial.println(getStatus());
  }
  
  // Pump 2 controls sections 3 and 4
  bool pump2Needed = false;
  static bool pump2IsOn = false;
  
  // Check if any section needs water
  if (pump2IsOn) {
    // Apply hysteresis when turning OFF
    pump2Needed = (moistureValues[2] > (moistureThreshold - MOISTURE_HYSTERESIS)) || 
                  (moistureValues[3] > (moistureThreshold - MOISTURE_HYSTERESIS));
  } else {
    // Apply hysteresis when turning ON
    pump2Needed = (moistureValues[2] > (moistureThreshold + MOISTURE_HYSTERESIS)) || 
                  (moistureValues[3] > (moistureThreshold + MOISTURE_HYSTERESIS));
  }
  
  // Only update if state changes
  if (pump2IsOn != pump2Needed) {
    digitalWrite(WATER_PUMP_PINS[1], pump2Needed ? LOW : HIGH);
    pump2IsOn = pump2Needed;
    Serial.println("\n=== Automatic Control Update (Pump 2) ===");
    Serial.println(getStatus());
  }
}

// Controls the fan based on sensor thresholds and a timer-based override.
// The timer override operates independently of sensor activations.
void controlFans() {
  if (!automaticMode) return;
  
  unsigned long currentMillis = millis();
  
  // Check if sensors require fan activation
  bool sensorFanNeeded = false;
  static bool fanIsOnDueToSensor = false;
  
  // Apply hysteresis based on current state
  if (fanIsOnDueToSensor) {
    // For turning OFF, use lower thresholds
    sensorFanNeeded = (tempValues[0] > (tempThreshold - TEMP_HYSTERESIS)) || 
                      (tempValues[1] > (tempThreshold - TEMP_HYSTERESIS)) || 
                      (co2ppm > (co2Threshold - CO2_HYSTERESIS));
  } else {
    // For turning ON, use higher thresholds
    sensorFanNeeded = (tempValues[0] > (tempThreshold + TEMP_HYSTERESIS)) || 
                      (tempValues[1] > (tempThreshold + TEMP_HYSTERESIS)) || 
                      (co2ppm > (co2Threshold + CO2_HYSTERESIS));
  }
  
  // Update fan state based on sensor readings
  if (fanIsOnDueToSensor != sensorFanNeeded) {
    fanIsOnDueToSensor = sensorFanNeeded;
    fanSensorActivated = sensorFanNeeded;
    
    if (sensorFanNeeded) {
      digitalWrite(FAN_PIN, LOW); // Turn fan ON
      Serial.println("\n=== Fan turned ON due to sensor thresholds ===");
    } else if (!fanTimerActive) {
      digitalWrite(FAN_PIN, HIGH); // Turn fan OFF only if timer isn't active
      Serial.println("\n=== Fan turned OFF (sensor thresholds no longer exceeded) ===");
    }
  }
  
  // Timer override: independent of sensor readings
  // If it's time for a scheduled fan run and the fan isn't already on due to sensors
  if (!fanTimerActive && !fanSensorActivated && (currentMillis - lastFanTimer >= FAN_INTERVAL)) {
    digitalWrite(FAN_PIN, LOW); // Turn fan ON
    fanTimerActive = true;
    fanTimerStart = currentMillis;
    Serial.println("\n=== Fan turned ON by timer override ===");
  }
  
  // If the fan timer is running and the time is up
  if (fanTimerActive && (currentMillis - fanTimerStart >= FAN_RUNTIME)) {
    // Only turn off if sensors don't need the fan
    if (!fanSensorActivated) {
      digitalWrite(FAN_PIN, HIGH); // Turn fan OFF
      Serial.println("\n=== Fan timer override ended, fan turned OFF ===");
    } else {
      Serial.println("\n=== Fan timer override ended, but fan remains ON due to sensor readings ===");
    }
    fanTimerActive = false;
    lastFanTimer = currentMillis;
  }
}

// Function to update Firebase with sensor data
void updateFirebase() {
  if (!firebaseConnected || !Firebase.ready()) return;
  
  // Validate sensor values before sending to Firebase
  float temp0 = isnan(tempValues[0]) ? 0.0 : tempValues[0];
  float temp1 = isnan(tempValues[1]) ? 0.0 : tempValues[1];
  float hum0 = isnan(humidityValues[0]) ? 0.0 : humidityValues[0];
  float hum1 = isnan(humidityValues[1]) ? 0.0 : humidityValues[1];
  float avgTempValid = isnan(avgTemp) ? 0.0 : avgTemp;
  float avgHumidityValid = isnan(avgHumidity) ? 0.0 : avgHumidity;
  float co2Valid = isnan(co2ppm) ? 400.0 : co2ppm; // Default to 400ppm if invalid
  
  // Current sensor readings
  FirebaseJson sensorJson;
  sensorJson.set("temperature/0", temp0);
  sensorJson.set("temperature/1", temp1);
  sensorJson.set("humidity/0", hum0);
  sensorJson.set("humidity/1", hum1);
  sensorJson.set("moisture/0", moistureValues[0]);
  sensorJson.set("moisture/1", moistureValues[1]);
  sensorJson.set("moisture/2", moistureValues[2]);
  sensorJson.set("moisture/3", moistureValues[3]);
  sensorJson.set("co2", co2Valid);
  sensorJson.set("lastUpdate", timeClient.getEpochTime() * 1000);
  sensorJson.set("memory", ESP.getFreeHeap());
  
  if (Firebase.RTDB.updateNode(&fbdo, "greenhouse/sensors", &sensorJson)) {
    // Reduced output - only print this message once every 10 updates
    static int updateCounter = 0;
    if (++updateCounter >= 10) {
      Serial.println("Firebase sensor update successful");
      updateCounter = 0;
    }
  } else {
    Serial.println("Firebase sensor update failed: " + fbdo.errorReason());
  }
  
  // Current relay states
  bool pump1State = (digitalRead(WATER_PUMP_PINS[0]) == LOW);
  bool pump2State = (digitalRead(WATER_PUMP_PINS[1]) == LOW);
  bool fanState = (digitalRead(FAN_PIN) == LOW);
  bool lightState = (digitalRead(LIGHT_PIN) == LOW);
  
  // Only update relay states if they've changed
  if (pump1State != lastPump1State || 
      pump2State != lastPump2State ||
      fanState != lastFanState ||
      lightState != lastLightState) {
    
    FirebaseJson relayJson;
    relayJson.set("pump1", pump1State);
    relayJson.set("pump2", pump2State);
    relayJson.set("fan", fanState);
    relayJson.set("light", lightState);
    
    if (Firebase.RTDB.updateNode(&fbdo, "greenhouse/relays", &relayJson)) {
      Serial.println("Firebase relay update successful");
    } else {
      Serial.println("Firebase relay update failed: " + fbdo.errorReason());
    }
    
    // Update last states
    lastPump1State = pump1State;
    lastPump2State = pump2State;
    lastFanState = fanState;
    lastLightState = lightState;
  }
  
  // IMPORTANT: Only update thresholds if they've changed from the last known values
  // This prevents overwriting values set from the web app
  bool thresholdsChanged = false;
  
  if (moistureThreshold != lastMoistureThreshold) {
    thresholdsChanged = true;
    Serial.println("Local moisture threshold changed: " + String(lastMoistureThreshold) + " -> " + String(moistureThreshold));
  }
  
  if (abs(tempThreshold - lastTempThreshold) > 0.01) {
    thresholdsChanged = true;
    Serial.println("Local temperature threshold changed: " + String(lastTempThreshold) + "°C -> " + String(tempThreshold) + "°C");
  }
  
  if (co2Threshold != lastCo2Threshold) {
    thresholdsChanged = true;
    Serial.println("Local CO2 threshold changed: " + String(lastCo2Threshold) + " -> " + String(co2Threshold));
  }
  
  // Only update if thresholds have actually changed
  if (thresholdsChanged) {
    FirebaseJson thresholdJson;
    thresholdJson.set("moisture", moistureThreshold);
    thresholdJson.set("temperature", tempThreshold);
    thresholdJson.set("co2", co2Threshold);
    
    // Use only the new time format (ISO string or HH:MM:SS)
    thresholdJson.set("lightOn", lightOnTimeStr);
    thresholdJson.set("lightOff", lightOffTimeStr);
    
    if (Firebase.RTDB.updateNode(&fbdo, "greenhouse/thresholds", &thresholdJson)) {
      Serial.println("Firebase threshold update successful");
      
      // Update last values after successful update
      lastMoistureThreshold = moistureThreshold;
      lastTempThreshold = tempThreshold;
      lastCo2Threshold = co2Threshold;
    } else {
      Serial.println("Firebase threshold update failed: " + fbdo.errorReason());
    }
  }
  
  // Only update mode if it's changed
  if (automaticMode != lastAutomaticMode) {
    FirebaseJson modeJson;
    modeJson.set("automatic", automaticMode);
    
    if (Firebase.RTDB.updateNode(&fbdo, "greenhouse/mode", &modeJson)) {
      Serial.println("Firebase mode update successful");
    } else {
      Serial.println("Firebase mode update failed: " + fbdo.errorReason());
    }
    
    // Update last mode
    lastAutomaticMode = automaticMode;
  }
}

// Function to update historical data
void updateHistoricalData() {
  if (!firebaseConnected || !Firebase.ready()) return;
  
  // Get current timestamp
  unsigned long timestamp = timeClient.getEpochTime() * 1000; // Convert to milliseconds
  
  // Get formatted date and time string
  String formattedDateTime = getFormattedDateTime();
  
  // Validate all values before sending to Firebase
  float temp0 = isnan(tempValues[0]) ? 0.0 : tempValues[0];
  float temp1 = isnan(tempValues[1]) ? 0.0 : tempValues[1];
  float hum0 = isnan(humidityValues[0]) ? 0.0 : humidityValues[0];
  float hum1 = isnan(humidityValues[1]) ? 0.0 : humidityValues[1];
  float avgTempValid = isnan(avgTemp) ? 0.0 : avgTemp;
  float avgHumidityValid = isnan(avgHumidity) ? 0.0 : avgHumidity;
  float co2Valid = isnan(co2ppm) ? 1.0 : co2ppm; // Default to 1ppm if invalid
  
  // Create JSON for historical data
  FirebaseJson historyJson;
  historyJson.set("timestamp", timestamp);
  historyJson.set("datetimeUpdate", formattedDateTime);
  
  // Store temperature values directly
  historyJson.set("temperature0", temp0);
  historyJson.set("temperature1", temp1);

  
  // Store humidity values directly
  historyJson.set("humidity0", hum0);
  historyJson.set("humidity1", hum1);
  
  // Store moisture values directly
  historyJson.set("moisture0", moistureValues[0]);
  historyJson.set("moisture1", moistureValues[1]);
  historyJson.set("moisture2", moistureValues[2]);
  historyJson.set("moisture3", moistureValues[3]);
  
  // Store CO2 value
  historyJson.set("co2", co2Valid);
  
  // Create a unique key based on timestamp
  String historyPath = "greenhouse/history/" + String(timestamp);
  
  if (Firebase.RTDB.setJSON(&fbdo, historyPath, &historyJson)) {
    Serial.println("Firebase history update successful");
    Serial.println("Timestamp: " + String(timestamp) + ", DateTime: " + formattedDateTime);
  } else {
    Serial.println("Firebase history update failed: " + fbdo.errorReason());
  }
}

// Function to get formatted date and time string from NTP client
String getFormattedDateTime() {
  // Format: YYYY-MM-DD HH:MM:SS
  String formattedDate = "";
  time_t epochTime = timeClient.getEpochTime();
  struct tm *ptm = gmtime ((time_t *)&epochTime);
  
  int currentYear = ptm->tm_year + 1900;
  int currentMonth = ptm->tm_mon + 1;
  int currentDay = ptm->tm_mday;
  int currentHour = ptm->tm_hour;
  int currentMinute = ptm->tm_min;
  int currentSecond = ptm->tm_sec;
  
  // Format with leading zeros
  formattedDate = String(currentYear) + "-";
  formattedDate += (currentMonth < 10) ? "0" + String(currentMonth) : String(currentMonth);
  formattedDate += "-";
  formattedDate += (currentDay < 10) ? "0" + String(currentDay) : String(currentDay);
  formattedDate += " ";
  formattedDate += (currentHour < 10) ? "0" + String(currentHour) : String(currentHour);
  formattedDate += ":";
  formattedDate += (currentMinute < 10) ? "0" + String(currentMinute) : String(currentMinute);
  formattedDate += ":";
  formattedDate += (currentSecond < 10) ? "0" + String(currentSecond) : String(currentSecond);
  
  return formattedDate;
}

// Check for Firebase commands with proper error handling
void checkFirebaseCommands() {
  if (!firebaseConnected || !Firebase.ready()) return;
  
  // Check for mode changes
  if (Firebase.RTDB.getBool(&fbdo, "greenhouse/mode/automatic")) {
    if (fbdo.dataType() == "boolean") {
      bool newMode = fbdo.boolData();
      if (newMode != automaticMode) {
        automaticMode = newMode;
        Serial.println("Mode changed via Firebase to: " + String(automaticMode ? "Automatic" : "Manual"));
      }
    }
  } else {
    Serial.println("Error getting mode: " + fbdo.errorReason());
  }
  
  // Check for threshold changes
  if (Firebase.RTDB.getInt(&fbdo, "greenhouse/thresholds/moisture")) {
    if (fbdo.dataType() == "int") {
      int newThreshold = fbdo.intData();
      if (newThreshold != moistureThreshold) {
        Serial.println("Moisture threshold changed via Firebase from " + String(moistureThreshold) + " to " + String(newThreshold));
        moistureThreshold = newThreshold;
        lastMoistureThreshold = newThreshold; // Important: update the last value immediately
      }
    }
  }
  
  // Try both getFloat and getDouble for temperature to ensure it works
  bool tempUpdated = false;
  
  if (Firebase.RTDB.getFloat(&fbdo, "greenhouse/thresholds/temperature")) {
    if (fbdo.dataType() == "float" || fbdo.dataType() == "double" || fbdo.dataType() == "int") {
      float newThreshold = fbdo.floatData();
      if (abs(newThreshold - tempThreshold) > 0.01) { // Use small epsilon for float comparison
        Serial.println("Temperature threshold changed via Firebase from " + String(tempThreshold) + "°C to " + String(newThreshold) + "°C");
        tempThreshold = newThreshold;
        lastTempThreshold = newThreshold; // Important: update the last value immediately
        tempUpdated = true;
      }
    }
  }
  
  // If getFloat didn't work, try getDouble as a fallback
  if (!tempUpdated && Firebase.RTDB.getDouble(&fbdo, "greenhouse/thresholds/temperature")) {
    if (fbdo.dataType() == "double" || fbdo.dataType() == "float" || fbdo.dataType() == "int") {
      double newThreshold = fbdo.doubleData();
      if (abs(newThreshold - tempThreshold) > 0.01) { // Use small epsilon for float comparison
        Serial.println("Temperature threshold changed via Firebase from " + String(tempThreshold) + "°C to " + String(newThreshold) + "°C");
        tempThreshold = newThreshold;
        lastTempThreshold = newThreshold; // Important: update the last value immediately
      }
    }
  }
  
  // If both methods failed, try getInt as a last resort
  if (!tempUpdated && Firebase.RTDB.getInt(&fbdo, "greenhouse/thresholds/temperature")) {
    if (fbdo.dataType() == "int") {
      int newThreshold = fbdo.intData();
      if (abs(newThreshold - tempThreshold) > 0.01) { // Use small epsilon for float comparison
        Serial.println("Temperature threshold changed via Firebase from " + String(tempThreshold) + "°C to " + String(newThreshold) + "°C");
        tempThreshold = newThreshold;
        lastTempThreshold = newThreshold; // Important: update the last value immediately
      }
    }
  }
  
  if (Firebase.RTDB.getInt(&fbdo, "greenhouse/thresholds/co2")) {
    if (fbdo.dataType() == "int") {
      int newThreshold = fbdo.intData();
      if (newThreshold != co2Threshold) {
        Serial.println("CO2 threshold changed via Firebase from " + String(co2Threshold) + " ppm to " + String(newThreshold) + " ppm");
        co2Threshold = newThreshold;
        lastCo2Threshold = newThreshold; // Important: update the last value immediately
      }
    }
  }
  
  // Check for new light schedule format (ISO strings)
  if (Firebase.RTDB.getString(&fbdo, "greenhouse/thresholds/lightOn")) {
    if (fbdo.dataType() == "string") {
      String newTimeStr = fbdo.stringData();
      if (newTimeStr != lightOnTimeStr) {
        // Store old values for comparison
        int oldHour = lightOnHour;
        int oldMinute = lightOnMinute;
        
        // Update the string
        lightOnTimeStr = newTimeStr;
        
        // Parse the time string
        parseTimeString(lightOnTimeStr, lightOnHour, lightOnMinute);
        
        Serial.println("Light ON time changed via Firebase from " + 
                      String(oldHour) + ":" + (oldMinute < 10 ? "0" : "") + String(oldMinute) + 
                      " to " + 
                      String(lightOnHour) + ":" + (lightOnMinute < 10 ? "0" : "") + String(lightOnMinute));
      }
    }
  }
  
  if (Firebase.RTDB.getString(&fbdo, "greenhouse/thresholds/lightOff")) {
    if (fbdo.dataType() == "string") {
      String newTimeStr = fbdo.stringData();
      if (newTimeStr != lightOffTimeStr) {
        // Store old values for comparison
        int oldHour = lightOffHour;
        int oldMinute = lightOffMinute;
        
        // Update the string
        lightOffTimeStr = newTimeStr;
        
        // Parse the time string
        parseTimeString(lightOffTimeStr, lightOffHour, lightOffMinute);
        
        Serial.println("Light OFF time changed via Firebase from " + 
                      String(oldHour) + ":" + (oldMinute < 10 ? "0" : "") + String(oldMinute) + 
                      " to " + 
                      String(lightOffHour) + ":" + (lightOffMinute < 10 ? "0" : "") + String(lightOffMinute));
      }
    }
  }
  
  // Remove the legacy hour format checks since we're now using the time string format
  
  // Check for manual relay controls (only in manual mode)
  if (!automaticMode) {
    if (Firebase.RTDB.getBool(&fbdo, "greenhouse/relays/pump1") && fbdo.dataType() == "boolean") {
      bool pumpState = fbdo.boolData();
      if (pumpState != (digitalRead(WATER_PUMP_PINS[0]) == LOW)) {
        digitalWrite(WATER_PUMP_PINS[0], pumpState ? LOW : HIGH);
        Serial.println("Pump 1 changed via Firebase to: " + String(pumpState ? "ON" : "OFF"));
      }
    }
    
    if (Firebase.RTDB.getBool(&fbdo, "greenhouse/relays/pump2") && fbdo.dataType() == "boolean") {
      bool pumpState = fbdo.boolData();
      if (pumpState != (digitalRead(WATER_PUMP_PINS[1]) == LOW)) {
        digitalWrite(WATER_PUMP_PINS[1], pumpState ? LOW : HIGH);
        Serial.println("Pump 2 changed via Firebase to: " + String(pumpState ? "ON" : "OFF"));
      }
    }
    
    if (Firebase.RTDB.getBool(&fbdo, "greenhouse/relays/fan") && fbdo.dataType() == "boolean") {
      bool fanState = fbdo.boolData();
      if (fanState != (digitalRead(FAN_PIN) == LOW)) {
        digitalWrite(FAN_PIN, fanState ? LOW : HIGH);
        fanSensorActivated = fanState; // Update fan sensor activation state
        Serial.println("Fan changed via Firebase to: " + String(fanState ? "ON" : "OFF"));
      }
    }
    
    if (Firebase.RTDB.getBool(&fbdo, "greenhouse/relays/light") && fbdo.dataType() == "boolean") {
      bool lightState = fbdo.boolData();
      if (lightState != (digitalRead(LIGHT_PIN) == LOW)) {
        digitalWrite(LIGHT_PIN, lightState ? LOW : HIGH);
        Serial.println("Light changed via Firebase to: " + String(lightState ? "ON" : "OFF"));
      }
    }
  }
}

// Non-blocking WiFi connection function
bool connectToWiFi(unsigned long timeout = 30000) {
  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  
  unsigned long startAttemptTime = millis();
  
  // Try to connect with a timeout
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < timeout) {
    delay(500);
    Serial.print(".");
    yield(); // Allow ESP32 to perform background tasks
  }
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected");
    Serial.println("IP address: " + WiFi.localIP().toString());
    return true;
  } else {
    Serial.println("WiFi connection failed");
    return false;
  }
}

// Function to check and manage WiFi connection
void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    if (!wasDisconnected) {
      Serial.println("WiFi disconnected. Attempting to reconnect...");
      wasDisconnected = true;
    }
    
    // Try to reconnect with a non-blocking approach
    if (reconnectStartTime == 0) {
      // First detection of disconnect
      reconnectStartTime = millis();
      reconnectAttempts = 0;
      WiFi.disconnect(); // Explicitly disconnect
    }
    
    if (millis() - reconnectStartTime >= WIFI_RETRY_DELAY) {
      // Time to try reconnecting
      reconnectStartTime = millis(); // Reset timer
      reconnectAttempts++;
      
      // Attempt to reconnect
      WiFi.begin(ssid, password);
      Serial.println("WiFi reconnect attempt " + String(reconnectAttempts));
      
      if (reconnectAttempts >= MAX_WIFI_RETRIES) {
        Serial.println("Maximum WiFi reconnection attempts reached. Restarting...");
        ESP.restart();
      }
    }
  } else {
    // WiFi is connected
    if (wasDisconnected) {
      // We just reconnected
      Serial.println("WiFi reconnected successfully");
      
      // Report reconnection event to Firebase if we were previously disconnected
      if (firebaseConnected && Firebase.ready()) {
        // Update the status with reconnection information
        FirebaseJson statusJson;
        statusJson.set("isOnline", true);
        statusJson.set("ipAddress", WiFi.localIP().toString());
        statusJson.set("reconnectTime", timeClient.getEpochTime() * 1000);
        statusJson.set("reconnectAttempts", reconnectAttempts);
        
        if (Firebase.RTDB.updateNode(&fbdo, "greenhouse/status", &statusJson)) {
          Serial.println("Reconnection event reported to Firebase");
        }
      }
      
      wasDisconnected = false;
    }
    
    // Reset reconnection variables
    reconnectStartTime = 0;
    reconnectAttempts = 0;
  }
}

// Function to update ESP32 status in Firebase
void updateESP32Status() {
  if (!firebaseConnected || !Firebase.ready()) return;
  
  // Track lowest heap
  unsigned long currentHeap = ESP.getFreeHeap();
  if (currentHeap < lowestHeap) {
    lowestHeap = currentHeap;
  }
  
  // Check for low memory conditions and report warnings
  if (currentHeap < CRITICAL_MEMORY_THRESHOLD) {
    reportSystemWarning("MEMORY", "CRITICAL", currentHeap, "Memory critically low!");
  } else if (currentHeap < LOW_MEMORY_THRESHOLD) {
    reportSystemWarning("MEMORY", "WARNING", currentHeap, "Memory running low");
  }
  
  // Get current timestamp
  unsigned long currentTime = timeClient.getEpochTime() * 1000;
  
  // Create status JSON
  FirebaseJson statusJson;
  statusJson.set("isOnline", true);
  statusJson.set("ipAddress", WiFi.localIP().toString());
  statusJson.set("lastSeen", currentTime); // Current time in milliseconds
  statusJson.set("timestamp", currentTime); // Additional timestamp field
  statusJson.set("freeHeap", currentHeap); // Add heap info directly to status for quick access
  statusJson.set("lowMemoryThreshold", LOW_MEMORY_THRESHOLD); // Add threshold values
  statusJson.set("criticalMemoryThreshold", CRITICAL_MEMORY_THRESHOLD);
  
  // Update status in Firebase
  if (Firebase.RTDB.updateNode(&fbdo, "greenhouse/status", &statusJson)) {
    // Reduced output - only print this message once every 10 updates
    static int statusCounter = 0;
    if (++statusCounter >= 10) {
      Serial.println("Firebase status update successful");
      statusCounter = 0;
    }
  } else {
    Serial.println("Firebase status update failed: " + fbdo.errorReason());
  }
  
  // Create memory JSON
  FirebaseJson memoryJson;
  memoryJson.set("freeHeap", currentHeap);
  memoryJson.set("lowestHeap", lowestHeap);
  memoryJson.set("timestamp", currentTime);
  memoryJson.set("lowMemoryThreshold", LOW_MEMORY_THRESHOLD);
  memoryJson.set("criticalMemoryThreshold", CRITICAL_MEMORY_THRESHOLD);
  
  // Update memory info in Firebase
  if (Firebase.RTDB.updateNode(&fbdo, "greenhouse/system/memory", &memoryJson)) {
    // Reduced output - only print this message once every 10 updates
    static int memoryCounter = 0;
    if (++memoryCounter >= 10) {
      Serial.println("Firebase memory update successful");
      memoryCounter = 0;
    }
  } else {
    Serial.println("Firebase memory update failed: " + fbdo.errorReason());
  }
}

// Function to report system warnings to Firebase
void reportSystemWarning(const String& type, const String& level, long value, const String& message) {
  if (!firebaseConnected || !Firebase.ready()) return;
  
  // Create a unique warning ID using timestamp
  String warningId = String(timeClient.getEpochTime());
  
  // Create warning JSON
  FirebaseJson warningJson;
  warningJson.set("type", type);
  warningJson.set("level", level);
  warningJson.set("value", value);
  warningJson.set("message", message);
  warningJson.set("timestamp", timeClient.getEpochTime() * 1000);
  
  // Path for this specific warning
  String warningPath = "greenhouse/warnings/" + warningId;
  
  // Send warning to Firebase
  if (Firebase.RTDB.setJSON(&fbdo, warningPath, &warningJson)) {
    Serial.println("System warning reported: " + message);
  } else {
    Serial.println("Failed to report system warning: " + fbdo.errorReason());
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== SmartSprout Greenhouse Control System v2.0 ===");
  
  // Initialize sensor pins
  for (int pin : SOIL_MOISTURE_PINS) {
    pinMode(pin, INPUT);
  }
  
  // Initialize relay pins as OUTPUT and set default state to OFF (HIGH for active low)
  for (int pin : WATER_PUMP_PINS) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, HIGH); // OFF
  }
  pinMode(FAN_PIN, OUTPUT);
  digitalWrite(FAN_PIN, HIGH); // OFF
  pinMode(LIGHT_PIN, OUTPUT);
  digitalWrite(LIGHT_PIN, HIGH); // OFF
  
  // Initialize sensors
  dht1.begin();
  dht2.begin();
  pinMode(MQ_PIN, INPUT);
  
  // Connect to Wi-Fi with timeout
  if (!connectToWiFi(60000)) { // 60 second timeout
    Serial.println("Initial WiFi connection failed. Restarting...");
    delay(1000);
    ESP.restart();
  }
  
  // Start the NTP client and set time offset for IST (UTC+5:30)
  timeClient.begin();
  timeClient.setTimeOffset(19800);
  timeClient.update();
  
  // Record startup time
  unsigned long startupEpoch = timeClient.getEpochTime();
  
  // Initialize Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Print Firebase configuration for debugging
  Serial.println("Firebase Configuration:");
  Serial.println("API Key: " + String(API_KEY));
  Serial.println("Database URL: " + String(DATABASE_URL));

  // Enable auto reconnect to WiFi
  Firebase.reconnectWiFi(true);

  // Assign the callback function for token generation
  config.token_status_callback = tokenStatusCallback;

  // Initialize Firebase with email/password auth
  Serial.println("Initializing Firebase with email/password auth...");
  
  // Set the registered user credentials
  auth.user.email = "ttarunthakur455@gmail.com";
  auth.user.password = "9418036195";
  
  // Initialize the library with the Firebase authen and config
  Firebase.begin(&config, &auth);
  
  // Wait for authentication
  Serial.println("Waiting for authentication token...");
  unsigned long tokenStartTime = millis();
  while ((config.signer.tokens.status == token_status_on_initialize || 
          config.signer.tokens.status == token_status_on_request) && 
          millis() - tokenStartTime < 30000) {
    Serial.print(".");
    delay(500);
  }
  Serial.println();
  
  if (config.signer.tokens.status == token_status_ready) {
    Serial.println("Token is ready");
    firebaseConnected = true;
    
    // IMPORTANT: Fetch thresholds from Firebase first before using local defaults
    Serial.println("Fetching thresholds from Firebase...");
    
    // Try to get temperature threshold
    if (Firebase.RTDB.getFloat(&fbdo, "greenhouse/thresholds/temperature")) {
      if (fbdo.dataType() == "float" || fbdo.dataType() == "double" || fbdo.dataType() == "int") {
        float newTemp = fbdo.floatData();
        Serial.println("Retrieved temperature threshold from Firebase: " + String(newTemp) + "°C");
        tempThreshold = newTemp;
        lastTempThreshold = newTemp; // Important: update the last value too
      }
    }
    
    // Try to get moisture threshold
    if (Firebase.RTDB.getInt(&fbdo, "greenhouse/thresholds/moisture")) {
      if (fbdo.dataType() == "int") {
        int newMoisture = fbdo.intData();
        Serial.println("Retrieved moisture threshold from Firebase: " + String(newMoisture));
        moistureThreshold = newMoisture;
        lastMoistureThreshold = newMoisture;
      }
    }
    
    // Try to get CO2 threshold
    if (Firebase.RTDB.getInt(&fbdo, "greenhouse/thresholds/co2")) {
      if (fbdo.dataType() == "int") {
        int newCO2 = fbdo.intData();
        Serial.println("Retrieved CO2 threshold from Firebase: " + String(newCO2) + " ppm");
        co2Threshold = newCO2;
        lastCo2Threshold = newCO2;
      }
    }
    
  } else {
    Serial.println("Token error: " + String(config.signer.tokens.error.message.c_str()));
    firebaseConnected = false;
  }
  
  // Set database read timeout to 1 minute
  config.timeout.serverResponse = 60 * 1000;

  // Check connection status
  Serial.println("Checking Firebase connection...");
  delay(2000); // Give it time to connect

  if (Firebase.ready()) {
    Serial.println("Firebase connection successful");
    firebaseConnected = true;
    
    // IMPORTANT: Fetch thresholds from Firebase first before using local defaults
    Serial.println("Fetching thresholds from Firebase...");
    
    // Try to get temperature threshold
    if (Firebase.RTDB.getFloat(&fbdo, "greenhouse/thresholds/temperature")) {
      if (fbdo.dataType() == "float" || fbdo.dataType() == "double" || fbdo.dataType() == "int") {
        float newTemp = fbdo.floatData();
        Serial.println("Retrieved temperature threshold from Firebase: " + String(newTemp) + "°C");
        tempThreshold = newTemp;
        lastTempThreshold = newTemp; // Important: update the last value too
      }
    }
    
    // Try to get moisture threshold
    if (Firebase.RTDB.getInt(&fbdo, "greenhouse/thresholds/moisture")) {
      if (fbdo.dataType() == "int") {
        int newMoisture = fbdo.intData();
        Serial.println("Retrieved moisture threshold from Firebase: " + String(newMoisture));
        moistureThreshold = newMoisture;
        lastMoistureThreshold = newMoisture;
      }
    }
    
    // Try to get CO2 threshold
    if (Firebase.RTDB.getInt(&fbdo, "greenhouse/thresholds/co2")) {
      if (fbdo.dataType() == "int") {
        int newCO2 = fbdo.intData();
        Serial.println("Retrieved CO2 threshold from Firebase: " + String(newCO2) + " ppm");
        co2Threshold = newCO2;
        lastCo2Threshold = newCO2;
      }
    }
    
  } else {
    Serial.println("Firebase connection failed");
    if (config.signer.tokens.status == token_status_error) {
      Serial.println("Token error: " + String(config.signer.tokens.error.message.c_str()));
    }
    firebaseConnected = false;
  }
  
  // Set up disconnect handler in Firebase
  if (firebaseConnected) {
    // Initial status update with startup time
    FirebaseJson statusJson;
    statusJson.set("isOnline", true);
    statusJson.set("ipAddress", WiFi.localIP().toString());
    statusJson.set("lastSeen", timeClient.getEpochTime() * 1000);
    statusJson.set("startTime", startupEpoch * 1000);
    statusJson.set("version", "2.0");
    
    if (Firebase.RTDB.updateNode(&fbdo, "greenhouse/status", &statusJson)) {
      Serial.println("Initial status update successful");
    }
    
    // Initial memory update
    FirebaseJson memoryJson;
    memoryJson.set("freeHeap", ESP.getFreeHeap());
    memoryJson.set("lowestHeap", ESP.getFreeHeap());
    memoryJson.set("timestamp", timeClient.getEpochTime() * 1000);
    
    if (Firebase.RTDB.updateNode(&fbdo, "greenhouse/system/memory", &memoryJson)) {
      Serial.println("Initial memory update successful");
    }
  }
  
  // Initial sensor reading
  readSensors();
  
  // Send initial data to Firebase
  if (firebaseConnected) {
    updateFirebase();
    updateHistoricalData();
  }
  
  // Start in manual mode for the first 10 minutes
  automaticMode = false;
  startupTime = millis();
  startupModeComplete = false;
  
  Serial.println("Starting in MANUAL mode for 10 minutes to allow initial adjustments.");
  
  String welcome = "🌿 Greenhouse monitoring system is online!\n\n";
  Serial.println("\n=== System Started ===");
  Serial.println(welcome);
  Serial.println(getStatus());
  
  // Initialize lowest heap value
  lowestHeap = ESP.getFreeHeap();
}

void loop() {
  unsigned long currentMillis = millis();
  
  // Check if startup period (10 minutes) has elapsed and switch to automatic mode
  if (!startupModeComplete && (currentMillis - startupTime >= STARTUP_MANUAL_DURATION)) {
    automaticMode = true;
    startupModeComplete = true;
    Serial.println("\n=== Startup period complete ===");
    Serial.println("Switching to AUTOMATIC mode after 10 minutes of manual operation");
    Serial.println(getStatus());
    
    // Update Firebase with the new mode immediately
    if (firebaseConnected) {
      FirebaseJson modeJson;
      modeJson.set("automatic", automaticMode);
      
      if (Firebase.RTDB.updateNode(&fbdo, "greenhouse/mode", &modeJson)) {
        Serial.println("Firebase mode update successful");
      } else {
        Serial.println("Firebase mode update failed: " + fbdo.errorReason());
      }
      
      lastAutomaticMode = automaticMode;
    }
  }

  // Check WiFi connection periodically
  if (currentMillis - lastWifiCheck >= WIFI_CHECK_INTERVAL) {
    checkWiFiConnection();
    lastWifiCheck = currentMillis;
  }

  // Update NTP time
  timeClient.update();
  
  // Read sensors periodically
  if (currentMillis - lastSensorRead >= SENSOR_READ_INTERVAL) {
    readSensors();
    lastSensorRead = currentMillis;
  }
  
  // Run automatic controls if in automatic mode
  if (automaticMode) {
    controlWaterPumps();
    controlFans();
    controlLights();
  }
  
  // Update Firebase with sensor data
  if (currentMillis - lastFirebaseUpdate >= FIREBASE_UPDATE_INTERVAL && WiFi.status() == WL_CONNECTED) {
    updateFirebase();
    lastFirebaseUpdate = currentMillis;
  }
  
  // Update historical data
  if (currentMillis - lastHistoryUpdate >= HISTORY_UPDATE_INTERVAL && WiFi.status() == WL_CONNECTED) {
    updateHistoricalData();
    lastHistoryUpdate = currentMillis;
  }
  
  // Check for Firebase commands
  if (WiFi.status() == WL_CONNECTED && firebaseConnected) {
    checkFirebaseCommands();
  }

  // Update status and memory information
  if (currentMillis - lastStatusUpdate >= STATUS_UPDATE_INTERVAL && WiFi.status() == WL_CONNECTED) {
    updateESP32Status();
    lastStatusUpdate = currentMillis;
  }

  // Small delay to avoid watchdog timer issues
  delay(100);
}