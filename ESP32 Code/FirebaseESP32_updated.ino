/*
 * SmartSprout Greenhouse Monitoring System
 * ESP32 Firebase Integration with SIM800L GPRS
 * 
 * This code connects an ESP32 to Firebase Realtime Database to:
 * - Send sensor data (soil moisture, temperature, humidity, soil temperature)
 * - Receive control commands (pump, fan, light control)
 * - Maintain automatic control based on thresholds
 * - Uses SIM800L for internet connectivity as backup/primary
 * - Uses SHT30 sensors for temperature/humidity
 * - Uses DS18B20 for soil temperature monitoring

 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>
#include <Wire.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include <ArduinoJson.h>
#include "Adafruit_SHT31.h"
#include <OneWire.h>
#include <DallasTemperature.h>

// SIM800L GPRS module
#define SIM800_TX_PIN 26
#define SIM800_RX_PIN 25
HardwareSerial sim800(2);

// Define your credentials here
#define WIFI_SSID "[YOUR_WIFI_SSID]"
#define WIFI_PASSWORD "[YOUR_WIFI_PASSWORD]"
#define FIREBASE_API_KEY "[YOUR_FIREBASE_API_KEY]"
#define FIREBASE_DATABASE_URL "[YOUR_FIREBASE_DATABASE_URL]"
#define FIREBASE_USER_EMAIL "[YOUR_EMAIL]"
#define FIREBASE_USER_PASSWORD "[YOUR_PASSWORD]"

// Wi-Fi connection parameters
#define WIFI_RECONNECT_INTERVAL 30000
#define WIFI_RETRY_DELAY 5000
#define MAX_WIFI_RETRIES 10

// Firebase project API Key and RTDB URL
#define API_KEY FIREBASE_API_KEY
#define DATABASE_URL FIREBASE_DATABASE_URL

// Firebase Data object
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
FirebaseJson json;

// Pin Definitions
const int SOIL_MOISTURE_PINS[] = {32, 33, 34, 35};
const int WATER_PUMP_PINS[] = {16, 17};
const int FAN_PIN = 23;
const int LIGHT_PIN = 27;
const int DS18B20_PIN_1 = 4;
const int DS18B20_PIN_2 = 5;

// I2C Bus Configuration for SHT30 sensors
#define I2C1_SDA 21
#define I2C1_SCL 22
#define SHT30_GREENHOUSE1_ADDR 0x44
#define SHT30_GREENHOUSE2_ADDR 0x45
#define I2C2_SDA 18
#define I2C2_SCL 19
#define SHT30_OUTSIDE_ADDR 0x44

// DS18B20 setup
OneWire oneWire1(DS18B20_PIN_1);
OneWire oneWire2(DS18B20_PIN_2);
DallasTemperature ds18b20_1(&oneWire1);
DallasTemperature ds18b20_2(&oneWire2);

// I2C Bus objects
TwoWire I2C_1 = TwoWire(0);
TwoWire I2C_2 = TwoWire(1);

// SHT30 sensor objects
Adafruit_SHT31 sht30_greenhouse1 = Adafruit_SHT31(&I2C_1);
Adafruit_SHT31 sht30_greenhouse2 = Adafruit_SHT31(&I2C_1);
Adafruit_SHT31 sht30_outside = Adafruit_SHT31(&I2C_2);

// Sensor status flags
bool sht30_gh1_connected = false;
bool sht30_gh2_connected = false;
bool sht30_out_connected = false;

// Control mode flag
bool automaticMode = true;

// Threshold values
int moistureThreshold = 1500;
float tempThreshold = 28.0;
String lightOnTimeStr = "07:00:00";
String lightOffTimeStr = "21:00:00";
int lightOnHour = 7, lightOnMinute = 0;
int lightOffHour = 21, lightOffMinute = 0;

// Timer variables
unsigned long lastFanTimer = 0;
const unsigned long FAN_INTERVAL = 3600000;
const unsigned long FAN_RUNTIME = 300000;
bool fanTimerActive = false;
unsigned long fanTimerStart = 0;
bool fanSensorActivated = false;

unsigned long lastPump1Activation = 0;
unsigned long lastPump2Activation = 0;
const unsigned long PUMP_RUNTIME = 5000;
const unsigned long PUMP_COOLDOWN = 3600000;
bool pump1Active = false, pump2Active = false;
unsigned long pump1StartTime = 0, pump2StartTime = 0;

// Hysteresis values
const int MOISTURE_HYSTERESIS = 100;
const float TEMP_HYSTERESIS = 0.5;

// Timer intervals
unsigned long lastFirebaseUpdate = 0;
const unsigned long FIREBASE_UPDATE_INTERVAL = 5000;
unsigned long lastStatusUpdate = 0;
const unsigned long STATUS_UPDATE_INTERVAL = 15000;
unsigned long lastHistoryUpdate = 0;
const unsigned long HISTORY_UPDATE_INTERVAL = 60000;
unsigned long lastSensorRead = 0;
const unsigned long SENSOR_READ_INTERVAL = 2000;
unsigned long lastWifiCheck = 0;
const unsigned long WIFI_CHECK_INTERVAL = 10000;

// NTP Client
WiFiUDP udp;
NTPClient timeClient(udp, "pool.ntp.org");

// New variables for non-blocking NTP sync
bool timeSynchronized = false;
unsigned long lastNtpSyncAttempt = 0;
const unsigned long NTP_RETRY_INTERVAL = 30000; // Try to sync every 30 seconds

// Connection tracking
enum ConnectionType { CONN_WIFI, CONN_GPRS, CONN_NONE };
ConnectionType currentConnection = CONN_NONE;
bool firebaseConnected = false;

// Global sensor variables
int moistureValues[4] = {0};
float tempValues[3] = {0.0};
float humidityValues[3] = {0.0};
float soilTempValues[2] = {0.0};
float avgGreenhouseTemp = 0.0, avgGreenhouseHumidity = 0.0;
float outsideTemp = 0.0, outsideHumidity = 0.0;

// Last state variables
bool lastPump1State = false, lastPump2State = false;
bool lastFanState = false, lastLightState = false;
bool lastAutomaticMode = true;
int lastMoistureThreshold = 1500;
float lastTempThreshold = 28.0;

// Reconnection variables
static unsigned long reconnectStartTime = 0;
static int reconnectAttempts = 0;
static bool wasDisconnected = false;

// Startup mode variables
unsigned long startupTime = 0;
const unsigned long STARTUP_MANUAL_DURATION = 10 * 60 * 1000;
bool startupModeComplete = false;

// Memory tracking
unsigned long lowestHeap = UINT32_MAX;
const unsigned long LOW_MEMORY_THRESHOLD = 40000;
const unsigned long CRITICAL_MEMORY_THRESHOLD = 20000;

// Firebase token status callback - removed duplicate (already defined in TokenHelper.h)

// SIM800L GPRS functions
bool initSIM800L() {
  sim800.begin(9600);
  delay(1000);
  
  // Test AT command
  sim800.println("AT");
  delay(1000);
  if (!sim800.find("OK")) return false;
  
  // Check SIM card status
  sim800.println("AT+CPIN?");
  delay(1000);
  if (!sim800.find("READY")) return false;
  
  // Check network registration
  sim800.println("AT+CREG?");
  delay(1000);
  
  // Attach to GPRS service
  sim800.println("AT+CGATT=1");
  delay(1000);
  
  // Set connection type to GPRS
  sim800.println("AT+SAPBR=3,1,\"CONTYPE\",\"GPRS\"");
  delay(1000);
  
  // Set APN (replace with your carrier's APN)
  sim800.println("AT+SAPBR=3,1,\"APN\",\"your_apn\"");
  delay(1000);
  
  // Open GPRS context
  sim800.println("AT+SAPBR=1,1");
  delay(2000);
  
  return true;
}

bool connectGPRS() {
  Serial.println("Attempting GPRS connection...");
  if (initSIM800L()) {
    currentConnection = CONN_GPRS;
    Serial.println("GPRS connected successfully");
    return true;
  }
  Serial.println("GPRS connection failed");
  return false;
}

// Parse ISO time string to get hour and minute
void parseTimeString(const String &timeString, int &hour, int &minute) {
  int tPos = timeString.indexOf('T');
  String timePart = timeString;
  
  if (tPos > 0) {
    timePart = timeString.substring(tPos + 1);
  }
  
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
  String status = "SmartSprout Status\n";
  status += "Mode: " + String(automaticMode ? "Auto" : "Manual") + "\n";
  status += "Connection: " + String(currentConnection == CONN_WIFI ? "WiFi" : currentConnection == CONN_GPRS ? "GPRS" : "None") + "\n";
  status += "Free Heap: " + String(ESP.getFreeHeap()) + " bytes\n";
  
  // Soil Moisture readings
  status += "Soil Moisture: ";
  for (int i = 0; i < 4; i++) {
    status += String(moistureValues[i]) + (i < 3 ? ", " : "\n");
  }
  
  // Soil Temperature readings (2 sensors)
  status += "Soil Temp: ";
  for (int i = 0; i < 2; i++) {
    status += String(soilTempValues[i], 1) + "°C" + (i < 1 ? ", " : "\n");
  }

  // Environmental Readings
  status += "Greenhouse Temp: " + String(avgGreenhouseTemp, 1) + "°C\n";
  status += "Greenhouse Humidity: " + String(avgGreenhouseHumidity, 1) + "%\n";
  status += "Outside Temp: " + String(outsideTemp, 1) + "°C\n";
  status += "Outside Humidity: " + String(outsideHumidity, 1) + "%\n";

  
  // Relay Status
  status += "Pumps: " + String(digitalRead(WATER_PUMP_PINS[0]) == LOW ? "ON" : "OFF");
  status += "/" + String(digitalRead(WATER_PUMP_PINS[1]) == LOW ? "ON" : "OFF") + "\n";
  status += "Fan: " + String(digitalRead(FAN_PIN) == LOW ? "ON" : "OFF") + "\n";
  status += "Lights: " + String(digitalRead(LIGHT_PIN) == LOW ? "ON" : "OFF") + "\n";
  
  return status;
}

// Read all sensor values and update global variables
void readSensors() {
  // Read soil moisture sensors (4 sensors)
  for (int i = 0; i < 4; i++) {
    moistureValues[i] = analogRead(SOIL_MOISTURE_PINS[i]);
  }
  
  // Read DS18B20 soil temperature sensors (separate pins for each sensor)
  ds18b20_1.requestTemperatures();
  ds18b20_2.requestTemperatures();
  
  // Read first soil temperature sensor
  float soilTemp1 = ds18b20_1.getTempCByIndex(0);
  if (soilTemp1 != DEVICE_DISCONNECTED_C) {
    soilTempValues[0] = soilTemp1;
  }
  
  // Read second soil temperature sensor
  float soilTemp2 = ds18b20_2.getTempCByIndex(0);
  if (soilTemp2 != DEVICE_DISCONNECTED_C) {
    soilTempValues[1] = soilTemp2;
  }
  
// Read SHT30 sensors using Adafruit SHT31 library
  // Greenhouse sensor 1 (inside greenhouse)
  if (sht30_gh1_connected) {
    float airTemp1 = sht30_greenhouse1.readTemperature();
    float hum1 = sht30_greenhouse1.readHumidity();
    if (!isnan(airTemp1) && !isnan(hum1)) {
      tempValues[0] = airTemp1;
      humidityValues[0] = hum1;
    }
  } else {
    // Set to NAN if sensor is disconnected
    tempValues[0] = NAN;
    humidityValues[0] = NAN;
  }
  
  // Greenhouse sensor 2 (inside greenhouse)
  if (sht30_gh2_connected) {
    float airTemp2 = sht30_greenhouse2.readTemperature();
    float hum2 = sht30_greenhouse2.readHumidity();
    if (!isnan(airTemp2) && !isnan(hum2)) {
      tempValues[1] = airTemp2;
      humidityValues[1] = hum2;
    }
  } else {
    // Set to NAN if sensor is disconnected
    tempValues[1] = NAN;
    humidityValues[1] = NAN;
  }

  // Outside sensor (external environment)
  if (sht30_out_connected) {
    float temp3 = sht30_outside.readTemperature();
    float hum3 = sht30_outside.readHumidity();
    if (!isnan(temp3) && !isnan(hum3)) {
      tempValues[2] = temp3;
      humidityValues[2] = hum3;
      outsideTemp = tempValues[2];
      outsideHumidity = humidityValues[2];
    }
  } else {
    // Set to NAN if sensor is disconnected
    tempValues[2] = NAN;
    humidityValues[2] = NAN;
    outsideTemp = NAN;
    outsideHumidity = NAN;
  }
  
  // Calculate greenhouse averages - handle potential NAN values
  int valid_temp_readings = 0;
  float total_temp = 0;
  if (!isnan(tempValues[0])) { total_temp += tempValues[0]; valid_temp_readings++; }
  if (!isnan(tempValues[1])) { total_temp += tempValues[1]; valid_temp_readings++; }
  avgGreenhouseTemp = (valid_temp_readings > 0) ? (total_temp / valid_temp_readings) : NAN;
  
  int valid_hum_readings = 0;
  float total_hum = 0;
  if (!isnan(humidityValues[0])) { total_hum += humidityValues[0]; valid_hum_readings++; }
  if (!isnan(humidityValues[1])) { total_hum += humidityValues[1]; valid_hum_readings++; }
  avgGreenhouseHumidity = (valid_hum_readings > 0) ? (total_hum / valid_hum_readings) : NAN;
}

// Controls water pumps with 5-second bursts and 1-hour cooldown
void controlWaterPumps() {
  if (!automaticMode) return;
  
  unsigned long currentMillis = millis();
  
  // === PUMP 1 CONTROL (Zones 1-2) ===
  // Check if pump 1 needs to run (soil moisture check)
  bool pump1ShouldRun = (moistureValues[0] > (moistureThreshold + MOISTURE_HYSTERESIS)) || 
                        (moistureValues[1] > (moistureThreshold + MOISTURE_HYSTERESIS));
  
  // If pump 1 is currently active, check if 5 seconds have passed
  if (pump1Active) {
    if (currentMillis - pump1StartTime >= PUMP_RUNTIME) {
      // Turn off pump after 5 seconds
      digitalWrite(WATER_PUMP_PINS[0], HIGH); // HIGH = OFF
      pump1Active = false;
      lastPump1Activation = currentMillis;
      Serial.println("=== Pump 1 turned OFF after 5-second burst ===");
    }
  } 
  // If pump 1 is not active, check if it should start
  else if (pump1ShouldRun && (currentMillis - lastPump1Activation >= PUMP_COOLDOWN)) {
    // Start pump 1 for 5 seconds (cooldown period has passed)
    digitalWrite(WATER_PUMP_PINS[0], LOW); // LOW = ON
    pump1Active = true;
    pump1StartTime = currentMillis;
    Serial.println("=== Pump 1 turned ON for 5-second burst (Zones 1-2 need water) ===");
  }
  
  // === PUMP 2 CONTROL (Zones 3-4) ===
  // Check if pump 2 needs to run (soil moisture check)
  bool pump2ShouldRun = (moistureValues[2] > (moistureThreshold + MOISTURE_HYSTERESIS)) || 
                        (moistureValues[3] > (moistureThreshold + MOISTURE_HYSTERESIS));
  
  // If pump 2 is currently active, check if 5 seconds have passed
  if (pump2Active) {
    if (currentMillis - pump2StartTime >= PUMP_RUNTIME) {
      // Turn off pump after 5 seconds
      digitalWrite(WATER_PUMP_PINS[1], HIGH); // HIGH = OFF
      pump2Active = false;
      lastPump2Activation = currentMillis;
      Serial.println("=== Pump 2 turned OFF after 5-second burst ===");
    }
  } 
  // If pump 2 is not active, check if it should start
  else if (pump2ShouldRun && (currentMillis - lastPump2Activation >= PUMP_COOLDOWN)) {
    // Start pump 2 for 5 seconds (cooldown period has passed)
    digitalWrite(WATER_PUMP_PINS[1], LOW); // LOW = ON
    pump2Active = true;
    pump2StartTime = currentMillis;
    Serial.println("=== Pump 2 turned ON for 5-second burst (Zones 3-4 need water) ===");
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
    // For turning OFF, use lower thresholds (hysteresis)
    sensorFanNeeded = (tempValues[0] > (tempThreshold - TEMP_HYSTERESIS)) || 
                      (tempValues[1] > (tempThreshold - TEMP_HYSTERESIS));
  } else {
    // For turning ON, use higher thresholds (hysteresis)
    sensorFanNeeded = (tempValues[0] > (tempThreshold + TEMP_HYSTERESIS)) || 
                      (tempValues[1] > (tempThreshold + TEMP_HYSTERESIS));
  }
  
  // Update fan state based on sensor readings
  if (fanIsOnDueToSensor != sensorFanNeeded) {
    fanIsOnDueToSensor = sensorFanNeeded;
    fanSensorActivated = sensorFanNeeded;
    
    if (sensorFanNeeded) {
      digitalWrite(FAN_PIN, LOW); // Turn fan ON
      Serial.println("=== Fan turned ON due to sensor thresholds ===");
    } else if (!fanTimerActive) {
      digitalWrite(FAN_PIN, HIGH); // Turn fan OFF only if timer isn't active
      Serial.println("=== Fan turned OFF (sensor thresholds no longer exceeded) ===");
    }
  }
  
  // Timer override: independent of sensor readings
  // If it's time for a scheduled fan run and the fan isn't already on due to sensors
  if (!fanTimerActive && !fanSensorActivated && (currentMillis - lastFanTimer >= FAN_INTERVAL)) {
    digitalWrite(FAN_PIN, LOW); // Turn fan ON
    fanTimerActive = true;
    fanTimerStart = currentMillis;
    Serial.println("=== Fan turned ON by timer override ===");
  }
  
  // If the fan timer is running and the time is up
  if (fanTimerActive && (currentMillis - fanTimerStart >= FAN_RUNTIME)) {
    // Only turn off if sensors don't need the fan
    if (!fanSensorActivated) {
      digitalWrite(FAN_PIN, HIGH); // Turn fan OFF
      Serial.println("=== Fan timer override ended, fan turned OFF ===");
    } else {
      Serial.println("=== Fan timer override ended, but fan remains ON due to sensor readings ===");
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
  float temp2 = isnan(tempValues[2]) ? 0.0 : tempValues[2];
  float hum0 = isnan(humidityValues[0]) ? 0.0 : humidityValues[0];
  float hum1 = isnan(humidityValues[1]) ? 0.0 : humidityValues[1];
  float hum2 = isnan(humidityValues[2]) ? 0.0 : humidityValues[2];
  float avgGreenhouseTempValid = isnan(avgGreenhouseTemp) ? 0.0 : avgGreenhouseTemp;
  float avgGreenhouseHumidityValid = isnan(avgGreenhouseHumidity) ? 0.0 : avgGreenhouseHumidity;

  
  // Current sensor readings
  FirebaseJson sensorJson;
  sensorJson.set("temperature/0", temp0);  // Greenhouse 1
  sensorJson.set("temperature/1", temp1);  // Greenhouse 2
  sensorJson.set("temperature/2", temp2);  // Outside
  sensorJson.set("humidity/0", hum0);      // Greenhouse 1
  sensorJson.set("humidity/1", hum1);      // Greenhouse 2
  sensorJson.set("humidity/2", hum2);      // Outside
  sensorJson.set("moisture/0", moistureValues[0]);
  sensorJson.set("moisture/1", moistureValues[1]);
  sensorJson.set("moisture/2", moistureValues[2]);
  sensorJson.set("moisture/3", moistureValues[3]);
  sensorJson.set("soilTemp/0", soilTempValues[0]);  // First soil temperature sensor
  sensorJson.set("soilTemp/1", soilTempValues[1]);  // Second soil temperature sensor

  sensorJson.set("avgGreenhouseTemp", avgGreenhouseTempValid);
  sensorJson.set("avgGreenhouseHumidity", avgGreenhouseHumidityValid);
  sensorJson.set("outsideTemp", temp2);
  sensorJson.set("outsideHumidity", hum2);
  sensorJson.set("lastUpdate", timeClient.getEpochTime() * 1000);
  sensorJson.set("memory", ESP.getFreeHeap());
  sensorJson.set("connectionType", currentConnection == CONN_WIFI ? "WiFi" : currentConnection == CONN_GPRS ? "GPRS" : "None");
  
  Firebase.RTDB.updateNode(&fbdo, "greenhouse/sensors", &sensorJson);
  
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
    
    Firebase.RTDB.updateNode(&fbdo, "greenhouse/relays", &relayJson);
    
    // Update last states
    lastPump1State = pump1State;
    lastPump2State = pump2State;
    lastFanState = fanState;
    lastLightState = lightState;
  }
  
  // Only update thresholds if they've changed
  bool thresholdsChanged = false;
  
  if (moistureThreshold != lastMoistureThreshold) {
    thresholdsChanged = true;
  }
  
  if (abs(tempThreshold - lastTempThreshold) > 0.01) {
    thresholdsChanged = true;
  }
  
  if (thresholdsChanged) {
    FirebaseJson thresholdJson;
    thresholdJson.set("moisture", moistureThreshold);
    thresholdJson.set("temperature", tempThreshold);
    thresholdJson.set("lightOn", lightOnTimeStr);
    thresholdJson.set("lightOff", lightOffTimeStr);
    
    if (Firebase.RTDB.updateNode(&fbdo, "greenhouse/thresholds", &thresholdJson)) {
      lastMoistureThreshold = moistureThreshold;
      lastTempThreshold = tempThreshold;
    }
  }
  
  // Only update mode if it's changed
  if (automaticMode != lastAutomaticMode) {
    FirebaseJson modeJson;
    modeJson.set("automatic", automaticMode);
    Firebase.RTDB.updateNode(&fbdo, "greenhouse/mode", &modeJson);
    lastAutomaticMode = automaticMode;
  }
}

// Function to update historical data silently on success
void updateHistoricalData() {
  if (!firebaseConnected || !Firebase.ready()) return;

  unsigned long timestamp = timeClient.getEpochTime() * 1000;
  
  // Validate all sensor values to avoid sending errors to Firebase
  float temp0 = isnan(tempValues[0]) ? 0.0 : tempValues[0];
  float temp1 = isnan(tempValues[1]) ? 0.0 : tempValues[1];
  float temp2 = isnan(tempValues[2]) ? 0.0 : tempValues[2];
  float hum0 = isnan(humidityValues[0]) ? 0.0 : humidityValues[0];
  float hum1 = isnan(humidityValues[1]) ? 0.0 : humidityValues[1];
  float hum2 = isnan(humidityValues[2]) ? 0.0 : humidityValues[2];
  float soilT0 = (soilTempValues[0] == DEVICE_DISCONNECTED_C) ? 0.0 : soilTempValues[0];
  float soilT1 = (soilTempValues[1] == DEVICE_DISCONNECTED_C) ? 0.0 : soilTempValues[1];
  float avgTemp = isnan(avgGreenhouseTemp) ? 0.0 : avgGreenhouseTemp;
  float avgHum = isnan(avgGreenhouseHumidity) ? 0.0 : avgGreenhouseHumidity;

  FirebaseJson historyJson;
  historyJson.set("timestamp", timestamp);
  historyJson.set("datetimeUpdate", getFormattedDateTime());
  historyJson.set("temperature0", temp0);
  historyJson.set("temperature1", temp1);
  historyJson.set("temperature2", temp2);
  historyJson.set("humidity0", hum0);
  historyJson.set("humidity1", hum1);
  historyJson.set("humidity2", hum2);
  historyJson.set("moisture0", moistureValues[0]);
  historyJson.set("moisture1", moistureValues[1]);
  historyJson.set("moisture2", moistureValues[2]);
  historyJson.set("moisture3", moistureValues[3]);
  historyJson.set("soilTemp0", soilT0);
  historyJson.set("soilTemp1", soilT1);
  historyJson.set("avgGreenhouseTemp", avgTemp);
  historyJson.set("avgGreenhouseHumidity", avgHum);

  String historyPath = "greenhouse/history/" + String(timestamp);
  
  // Only report to Serial Monitor IF there is an error
  if (!Firebase.RTDB.setJSON(&fbdo, historyPath, &historyJson)) {
    Serial.println("!!! FAILED to log historical data. REASON: " + fbdo.errorReason());
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
        Serial.println("----------------------------------------");
        Serial.println(getStatus());
        Serial.println("----------------------------------------");
      }
    }
  }
  
  // Check for threshold changes
  if (Firebase.RTDB.getInt(&fbdo, "greenhouse/thresholds/moisture")) {
    if (fbdo.dataType() == "int") {
      int newThreshold = fbdo.intData();
      if (newThreshold != moistureThreshold) {
        moistureThreshold = newThreshold;
        lastMoistureThreshold = newThreshold;
      }
    }
  }
  
  // Check temperature threshold
  if (Firebase.RTDB.getFloat(&fbdo, "greenhouse/thresholds/temperature")) {
    if (fbdo.dataType() == "float" || fbdo.dataType() == "double" || fbdo.dataType() == "int") {
      float newThreshold = fbdo.floatData();
      if (abs(newThreshold - tempThreshold) > 0.01) {
        tempThreshold = newThreshold;
        lastTempThreshold = newThreshold;
      }
    }
  }
  

  
  // Check for light schedule changes
  if (Firebase.RTDB.getString(&fbdo, "greenhouse/thresholds/lightOn")) {
    if (fbdo.dataType() == "string") {
      String newTimeStr = fbdo.stringData();
      if (newTimeStr != lightOnTimeStr) {
        lightOnTimeStr = newTimeStr;
        parseTimeString(lightOnTimeStr, lightOnHour, lightOnMinute);
      }
    }
  }
  
  if (Firebase.RTDB.getString(&fbdo, "greenhouse/thresholds/lightOff")) {
    if (fbdo.dataType() == "string") {
      String newTimeStr = fbdo.stringData();
      if (newTimeStr != lightOffTimeStr) {
        lightOffTimeStr = newTimeStr;
        parseTimeString(lightOffTimeStr, lightOffHour, lightOffMinute);
      }
    }
  }
  
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
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long startAttemptTime = millis();
  
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < timeout) {
    delay(500);
    yield();
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    currentConnection = CONN_WIFI;
    return true;
  }
  return false;
}

// Try to establish internet connection (WiFi first, then GPRS)
bool establishConnection() {
  // Try WiFi first
  if (connectToWiFi(15000)) {
    return true;
  }
  
  // If WiFi fails, try GPRS
  if (connectGPRS()) {
    return true;
  }
  
  currentConnection = CONN_NONE;
  return false;
}

// Function to check and manage connection
void checkConnection() {
  bool connected = false;
  
  if (currentConnection == CONN_WIFI) {
    connected = (WiFi.status() == WL_CONNECTED);
  } else if (currentConnection == CONN_GPRS) {
    // Check GPRS connection status
    sim800.println("AT+CGATT?");
    delay(1000);
    connected = sim800.find("+CGATT: 1");
  }
  
  if (!connected && !wasDisconnected) {
    wasDisconnected = true;
    reconnectStartTime = millis();
    reconnectAttempts = 0;
  }
  
  if (!connected && (millis() - reconnectStartTime >= WIFI_RETRY_DELAY)) {
    reconnectStartTime = millis();
    reconnectAttempts++;
    
    if (reconnectAttempts >= MAX_WIFI_RETRIES) {
      ESP.restart();
    }
    
    // Try to reestablish connection
    establishConnection();
  }
  
  if (connected && wasDisconnected) {
    wasDisconnected = false;
    reconnectStartTime = 0;
    reconnectAttempts = 0;
  }
}

// Function to update ESP32 status in Firebase
void updateESP32Status() {
  if (!firebaseConnected || !Firebase.ready()) return;
  
  unsigned long currentHeap = ESP.getFreeHeap();
  if (currentHeap < lowestHeap) {
    lowestHeap = currentHeap;
  }
  
  if (currentHeap < CRITICAL_MEMORY_THRESHOLD) {
    reportSystemWarning("MEMORY", "CRITICAL", currentHeap, "Memory critically low!");
  } else if (currentHeap < LOW_MEMORY_THRESHOLD) {
    reportSystemWarning("MEMORY", "WARNING", currentHeap, "Memory running low");
  }
  
  unsigned long currentTime = timeClient.getEpochTime() * 1000;
  
  FirebaseJson statusJson;
  statusJson.set("isOnline", true);
  statusJson.set("ipAddress", currentConnection == CONN_WIFI ? WiFi.localIP().toString() : "GPRS");
  statusJson.set("lastSeen", currentTime);
  statusJson.set("timestamp", currentTime);
  statusJson.set("freeHeap", currentHeap);
  statusJson.set("connectionType", currentConnection == CONN_WIFI ? "WiFi" : currentConnection == CONN_GPRS ? "GPRS" : "None");
  
  Firebase.RTDB.updateNode(&fbdo, "greenhouse/status", &statusJson);
  
  FirebaseJson memoryJson;
  memoryJson.set("freeHeap", currentHeap);
  memoryJson.set("lowestHeap", lowestHeap);
  memoryJson.set("timestamp", currentTime);
  
  Firebase.RTDB.updateNode(&fbdo, "greenhouse/system/memory", &memoryJson);
}

// Function to report system warnings to Firebase
void reportSystemWarning(const String& type, const String& level, long value, const String& message) {
  if (!firebaseConnected || !Firebase.ready()) return;
  
  String warningId = String(timeClient.getEpochTime());
  
  FirebaseJson warningJson;
  warningJson.set("type", type);
  warningJson.set("level", level);
  warningJson.set("value", value);
  warningJson.set("message", message);
  warningJson.set("timestamp", timeClient.getEpochTime() * 1000);
  
  String warningPath = "greenhouse/warnings/" + warningId;
  Firebase.RTDB.setJSON(&fbdo, warningPath, &warningJson);
}

void reconnectFirebase();


void setup() {
  Serial.begin(115200);
  Serial.println("SmartSprout v2.1 - SHT30/DS18B20/SIM800L");
  
  // Initialize I2C buses for SHT30 sensors
  I2C_1.begin(I2C1_SDA, I2C1_SCL, 100000);  // Bus 1: GPIO21(SDA), GPIO22(SCL) - Greenhouse sensors
  I2C_2.begin(I2C2_SDA, I2C2_SCL, 100000);  // Bus 2: GPIO18(SDA), GPIO19(SCL) - Outside sensor
  
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
  
  // Initialize DS18B20 sensors
  ds18b20_1.begin();
  ds18b20_2.begin();

    // Initialize SHT30 sensors and set status flags
  Serial.println("Initializing SHT30 sensors...");
  if (sht30_greenhouse1.begin(SHT30_GREENHOUSE1_ADDR)) {
    sht30_gh1_connected = true;
    Serial.println("Found SHT30 greenhouse sensor 1.");
  } else {
    Serial.println("ERROR: Could not find SHT30 greenhouse sensor 1! Check wiring.");
  }

  if (sht30_greenhouse2.begin(SHT30_GREENHOUSE2_ADDR)) {
    sht30_gh2_connected = true;
    Serial.println("Found SHT30 greenhouse sensor 2.");
  } else {
    Serial.println("ERROR: Could not find SHT30 greenhouse sensor 2! Check wiring.");
  }

  if (sht30_outside.begin(SHT30_OUTSIDE_ADDR)) {
    sht30_out_connected = true;
    Serial.println("Found SHT30 outside sensor.");
  } else {
    Serial.println("ERROR: Could not find SHT30 outside sensor! Check wiring.");
  }
  
  // Establish internet connection (WiFi or GPRS)
  if (!establishConnection()) {
    Serial.println("No internet connection available. Restarting...");
    delay(5000);
    ESP.restart();
  }

 // Start the NTP client and set time offset for IST (UTC+5:30)
  timeClient.begin();
  timeClient.setTimeOffset(19800);

  Serial.print("Attempting initial time synchronization");
  
  // Set a short timeout for the initial NTP sync
  unsigned long ntpTimeout = 15000; // 15-second timeout
  unsigned long ntpStartTime = millis();
  
  while (millis() - ntpStartTime < ntpTimeout) {
    if (timeClient.update()) {
      timeSynchronized = true; // Set our flag to true on success
      break; // Exit the loop
    }
    Serial.print(".");
    delay(1000);
  }

  if (timeSynchronized) {
    Serial.println("\nTime synchronized successfully!");
  } else {
    Serial.println("\nWARNING: Failed to synchronize time on startup. Will retry in the background.");
    lastNtpSyncAttempt = millis(); // Start the retry timer
  }

  if (timeSynchronized) {
    Serial.println("\nTime synchronized successfully!");
  } else {
    Serial.println("\nWARNING: Failed to synchronize time. System will continue with incorrect time.");
    // The program will now continue running even if time sync fails.
  }

  // Record startup time
  unsigned long startupEpoch = timeClient.getEpochTime();
  
  // Initialize Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  Firebase.reconnectWiFi(true);
  config.token_status_callback = tokenStatusCallback;
  
  // Set the registered user credentials
  auth.user.email = FIREBASE_USER_EMAIL;
  auth.user.password = FIREBASE_USER_PASSWORD;
  
  Firebase.begin(&config, &auth);
  
  // Wait for authentication
  unsigned long tokenStartTime = millis();
  while ((config.signer.tokens.status == token_status_on_initialize || 
          config.signer.tokens.status == token_status_on_request) && 
          millis() - tokenStartTime < 30000) {
    delay(500);
  }
  
  if (config.signer.tokens.status == token_status_ready) {
    firebaseConnected = true;
    
    // Fetch thresholds from Firebase
    if (Firebase.RTDB.getFloat(&fbdo, "greenhouse/thresholds/temperature")) {
      if (fbdo.dataType() == "float" || fbdo.dataType() == "double" || fbdo.dataType() == "int") {
        float newTemp = fbdo.floatData();
        tempThreshold = newTemp;
        lastTempThreshold = newTemp;
      }
    }
    
    if (Firebase.RTDB.getInt(&fbdo, "greenhouse/thresholds/moisture")) {
      if (fbdo.dataType() == "int") {
        int newMoisture = fbdo.intData();
        moistureThreshold = newMoisture;
        lastMoistureThreshold = newMoisture;
      }
    }
      
  } else {
    firebaseConnected = false;
  }
  
  config.timeout.serverResponse = 60 * 1000;
  delay(2000);

  if (Firebase.ready()) {
    firebaseConnected = true;
  } else {
    firebaseConnected = false;
  }
  
  // Set up initial status if Firebase connected
  if (firebaseConnected) {
    FirebaseJson statusJson;
    statusJson.set("isOnline", true);
    statusJson.set("ipAddress", currentConnection == CONN_WIFI ? WiFi.localIP().toString() : "GPRS");
    statusJson.set("lastSeen", timeClient.getEpochTime() * 1000);
    statusJson.set("startTime", startupEpoch * 1000);
    statusJson.set("version", "2.1");
    statusJson.set("connectionType", currentConnection == CONN_WIFI ? "WiFi" : "GPRS");
    Firebase.RTDB.updateNode(&fbdo, "greenhouse/status", &statusJson);
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
  
  Serial.println("System started - Manual mode for 10 minutes");
  Serial.println(getStatus());
  
  lowestHeap = ESP.getFreeHeap();
}


void loop() {
  unsigned long currentMillis = millis();

  if (!startupModeComplete && (currentMillis - startupTime >= STARTUP_MANUAL_DURATION)) {
    automaticMode = true;
    startupModeComplete = true;
    Serial.println("Startup manual mode finished. Switching to Automatic Mode.");
    Serial.println("----------------------------------------");
    Serial.println(getStatus());
    Serial.println("----------------------------------------");
    if (firebaseConnected) {
      Firebase.RTDB.setBool(&fbdo, "greenhouse/mode/automatic", true);
    }
  } // <-- This closing brace was missing

  if (currentMillis - lastWifiCheck >= WIFI_CHECK_INTERVAL) {
    checkConnection();
  }

  if (!timeSynchronized && (currentMillis - lastNtpSyncAttempt >= NTP_RETRY_INTERVAL)) {
    Serial.println("Retrying NTP time synchronization...");
    if (timeClient.update()) {
      timeSynchronized = true;
      Serial.println("Background NTP sync successful!");
    } else {
      Serial.println("Background NTP sync failed. Will try again later.");
    }
    lastNtpSyncAttempt = currentMillis; // Reset the timer
  }

  static unsigned long lastReconnectAttempt = 0;
  if (currentConnection != CONN_NONE && !Firebase.ready()) {
    firebaseConnected = false;
    // Mark as disconnected immediately

    if (currentMillis - lastReconnectAttempt >= 30000) { // Only try every 30 seconds
      Serial.println("Firebase session lost. Attempting to reconnect...");
      reconnectFirebase(); // Call the non-blocking reconnect function
      lastReconnectAttempt = currentMillis;
    }
  } else if (Firebase.ready() && !firebaseConnected) {
    // This will run once the reconnection is successful
    firebaseConnected = true;
    Serial.println("Firebase session re-established successfully!");
  }

  timeClient.update();

  if (currentMillis - lastSensorRead >= SENSOR_READ_INTERVAL) {
    readSensors();
    lastSensorRead = currentMillis;
  }

  if (automaticMode) {
    controlWaterPumps();
    controlFans();
    controlLights();
  }

  if (currentMillis - lastFirebaseUpdate >= FIREBASE_UPDATE_INTERVAL) {
    updateFirebase();
    lastFirebaseUpdate = currentMillis;
  }

  if (currentMillis - lastHistoryUpdate >= HISTORY_UPDATE_INTERVAL) {
    updateHistoricalData();
    lastHistoryUpdate = currentMillis;
  }

  if (firebaseConnected) {
    checkFirebaseCommands();
  }

  if (currentMillis - lastStatusUpdate >= STATUS_UPDATE_INTERVAL) {
    updateESP32Status();
    lastStatusUpdate = currentMillis;
  }

  delay(100);
}

// Function to handle F irebase reconnection
void reconnectFirebase() {
  Serial.println("Attempting to re-sign in to Firebase...");
  firebaseConnected = false;
  // Set credentials for re-authentication
  auth.user.email = FIREBASE_USER_EMAIL;
  auth.user.password = FIREBASE_USER_PASSWORD;

  // Begin the reconnection process
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}