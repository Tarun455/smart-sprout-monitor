# SmartSprout Greenhouse Monitoring System v2.1

A comprehensive greenhouse automation and monitoring system using dual ESP32 modules with multiple sensors, Firebase integration, and dual connectivity (WiFi + GPRS backup) for reliable operation.

## Dual ESP32 Architecture

The system consists of two ESP32 modules working together:

1. **Main Controller** (`FirebaseESP32_updated.ino`): Handles environmental monitoring and automation control
2. **ESP32-CAM Module** (`espcam_firebase.ino`): Manages time-lapse photography with offline storage capability

## System Overview

The SmartSprout system provides complete greenhouse automation with:

1. **Environmental Monitoring**: Multi-sensor data collection (temperature, humidity, soil moisture, soil temperature)
2. **Automated Control**: Smart irrigation with 5-second bursts, intelligent ventilation, and scheduled lighting
3. **Dual Connectivity**: WiFi primary with SIM800L GPRS backup for reliable internet connection
4. **Real-time Data**: Firebase Realtime Database integration for live monitoring and remote control
5. **Safety Features**: 10-minute startup safety mode, hysteresis control, and automatic failover
6. **Time Synchronization**: NTP client with IST timezone support and non-blocking sync

## Main Features

### Advanced Sensor Monitoring
- **3x SHT30 Sensors**: High-precision temperature/humidity monitoring (2 greenhouse + 1 outside)
- **4x Soil Moisture Sensors**: Individual zone monitoring for precise irrigation
- **2x DS18B20 Soil Temperature**: Waterproof sensors for soil temperature tracking (separate pins for better reliability)

### Intelligent Equipment Control
- **2x Water Pump Relays**: Zone-based irrigation (Pump 1: zones 1-2, Pump 2: zones 3-4)
- **1x Ventilation Fan**: Dual-mode operation (sensor-based + timer-based)
- **1x Grow Light**: Programmable schedule with remote configuration

### Connectivity & Reliability
- **Primary WiFi**: Fast, reliable local network connection
- **GPRS Backup**: SIM800L module for internet when WiFi fails
- **Auto-Failover**: Seamless switching between connection types
- **Connection Monitoring**: Automatic reconnection and system restart on failures

### Smart Control Features
- **Hysteresis Control**: Prevents rapid relay switching and equipment wear
- **Startup Safety**: 10-minute manual mode on boot for system safety
- **Timer-Based Ventilation**: Periodic air circulation independent of sensors
- **Scheduled Lighting**: Configurable on/off times with overnight support
- **Memory Monitoring**: Low memory warnings and system health tracking

## Hardware Requirements

### Main Components

#### Main Controller Module
| Component | Quantity | Model/Type | Purpose |
|-----------|----------|------------|---------|
| ESP32 Development Board | 1 | ESP32-WROOM-32 | Main microcontroller |
| SHT30 Temperature/Humidity | 3 | SHT30 I2C | Environmental monitoring |
| DS18B20 Soil Temperature | 2 | Waterproof DS18B20 | Soil temperature (separate pins) |
| Soil Moisture Sensors | 4 | Capacitive/Resistive | Irrigation control |
| SIM800L GPRS Module | 1 | SIM800L EVB | Backup connectivity |
| 4-Channel Relay Module | 1 | 5V Active Low | Device control |
| Water Pumps | 2 | 12V DC | Irrigation system |
| Cooling Fan | 1 | 12V DC | Ventilation |
| LED Grow Light | 1 | 12V/24V | Plant lighting |

#### ESP32-CAM Module
| Component | Quantity | Model/Type | Purpose |
|-----------|----------|------------|---------|
| ESP32-CAM Board | 1 | AI-Thinker ESP32-CAM | Camera module with WiFi |
| MicroSD Card | 1 | Class 10, 8GB+ | Offline photo storage |
| External Antenna | 1 | 2.4GHz WiFi Antenna | Better WiFi reception |
| Flash LED | 1 | Built-in GPIO4 | Photo illumination |

### Pin Configuration

#### Main Controller (FirebaseESP32_updated.ino)
```cpp
// Sensor Connections
const int SOIL_MOISTURE_PINS[] = {32, 33, 34, 35};  // 4x Soil moisture sensors (analog)
const int DS18B20_PIN_1 = 4;                        // First DS18B20 soil temperature sensor
const int DS18B20_PIN_2 = 5;                        // Second DS18B20 soil temperature sensor
// Note: Each DS18B20 requires 4.7kΩ pull-up resistor between data and power

// I2C Bus 1 (Greenhouse sensors) - SDA: GPIO21, SCL: GPIO22
#define I2C1_SDA 21
#define I2C1_SCL 22
#define SHT30_GREENHOUSE1_ADDR 0x44  // First greenhouse sensor (ADDR pin LOW)
#define SHT30_GREENHOUSE2_ADDR 0x45  // Second greenhouse sensor (ADDR pin HIGH)

// I2C Bus 2 (Outside sensor) - SDA: GPIO18, SCL: GPIO19  
#define I2C2_SDA 18
#define I2C2_SCL 19
#define SHT30_OUTSIDE_ADDR 0x44      // Outside sensor (ADDR pin LOW)

// Relay Control Pins (Active Low - LOW = ON, HIGH = OFF)
const int WATER_PUMP_PINS[] = {16, 17};             // Water pump relays (Pump1: zones 1-2, Pump2: zones 3-4)
const int FAN_PIN = 23;                             // Fan relay
const int LIGHT_PIN = 27;                           // Light relay

// SIM800L GPRS Module (Hardware Serial 2)
#define SIM800_TX_PIN 26                            // ESP32 TX to SIM800L RX
#define SIM800_RX_PIN 25                            // ESP32 RX to SIM800L TX
```

#### ESP32-CAM Module (espcam_firebase.ino)
```cpp
// Camera Pin Configuration (AI-Thinker Model)
#define FLASH_LED_PIN 4              // Built-in flash LED
#define PWDN_GPIO_NUM     32         // Power down pin
#define RESET_GPIO_NUM    -1         // Reset pin (not used)
#define XCLK_GPIO_NUM      0         // External clock
#define SIOD_GPIO_NUM     26         // I2C SDA for camera
#define SIOC_GPIO_NUM     27         // I2C SCL for camera
#define Y9_GPIO_NUM       35         // Camera data pins
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25         // Vertical sync
#define HREF_GPIO_NUM     23         // Horizontal reference
#define PCLK_GPIO_NUM     22         // Pixel clock

// Photo Settings
unsigned long interval = 12 * 60 * 60 * 1000;      // Default 12 hours
const unsigned long MIN_INTERVAL = 15 * 60 * 1000; // 15 minutes minimum
const unsigned long MAX_INTERVAL = 48 * 60 * 60 * 1000; // 48 hours maximum
```

### Wiring Diagram

#### Power Distribution
```
12V Power Supply
├── Water Pumps (12V)
├── Cooling Fan (12V)
├── Grow Light (12V)
└── 5V Regulator
    ├── Relay Module (5V)
    └── 3.3V Regulator
        ├── ESP32 (3.3V)
        ├── SHT30 Sensors (3.3V)
        ├── DS18B20 Sensors (3.3V)
        └── Soil Moisture Sensors (3.3V)

SIM800L: Separate 3.7-4.2V Li-Po battery or dedicated power supply
```

#### Sensor Connections
```
SHT30 Sensors (Dual I2C Bus Configuration):
Bus 1 (Greenhouse Sensors 1 & 2):
- VCC → 3.3V, GND → Ground
- SDA → GPIO 21, SCL → GPIO 22
- Sensor 1: ADDR pin → LOW (Address 0x44)
- Sensor 2: ADDR pin → HIGH (Address 0x45)

Bus 2 (Outside Sensor):
- VCC → 3.3V, GND → Ground  
- SDA → GPIO 18, SCL → GPIO 19
- ADDR pin → LOW (Address 0x44)

DS18B20 Sensors (OneWire - Separate Pins):
- Sensor 1: VCC→3.3V, GND→Ground, Data→GPIO4, 4.7kΩ pullup resistor
- Sensor 2: VCC→3.3V, GND→Ground, Data→GPIO5, 4.7kΩ pullup resistor

Soil Moisture Sensors:
- Sensor 1: VCC→3.3V, GND→Ground, Signal→GPIO32
- Sensor 2: VCC→3.3V, GND→Ground, Signal→GPIO33
- Sensor 3: VCC→3.3V, GND→Ground, Signal→GPIO34
- Sensor 4: VCC→3.3V, GND→Ground, Signal→GPIO35

SIM800L Module:
- VCC → 3.7-4.2V (separate power)
- GND → Ground (common with ESP32)
- TX → GPIO25 (ESP32 RX)
- RX → GPIO26 (ESP32 TX)
```

## Software Setup

### Required Arduino Libraries

#### Main Controller Libraries
Install these libraries through Arduino IDE Library Manager:

```cpp
// Core ESP32 Libraries
#include <WiFi.h>
#include <Wire.h>
#include <SoftwareSerial.h>

// Firebase Integration
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

// Sensor Libraries
#include "Adafruit_SHT31.h"     // SHT30 temperature/humidity sensors (using Adafruit SHT31 library)
#include <OneWire.h>            // OneWire protocol for DS18B20
#include <DallasTemperature.h>  // DS18B20 temperature sensors

// Utility Libraries
#include <ArduinoJson.h>        // JSON data handling
#include <WiFiUdp.h>            // UDP for NTP
#include <NTPClient.h>          // Network time synchronization
```

#### ESP32-CAM Libraries
```cpp
// Core ESP32-CAM Libraries
#include <Arduino.h>
#include <WiFi.h>
#include "soc/soc.h"           // Brownout detector disable
#include "soc/rtc_cntl_reg.h"  // RTC control register
#include "esp_camera.h"        // Camera functionality

// Firebase Integration
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>
#include <addons/RTDBHelper.h>

// Storage and Time
#include "time.h"              // NTP time functions
#include "FS.h"                // File system
#include <SD_MMC.h>            // SD card support
#include <Preferences.h>       // Non-volatile storage
```

### Configuration Steps

#### Main Controller Setup

1. **Install Arduino IDE** and ESP32 board support package

2. **Install all required libraries** via Arduino IDE Library Manager:
   - **"Firebase ESP Client"** by Mobizt
   - **"Adafruit SHT31 Library"** by Adafruit (compatible with SHT30 sensors)
   - **"Adafruit BusIO"** by Adafruit (dependency)
   - **"OneWire"** by Jim Studt
   - **"DallasTemperature"** by Miles Burton
   - **"ArduinoJson"** by Benoit Blanchon
   - **"NTPClient"** by Fabrice Weinberg

3. **Configure system credentials** in `FirebaseESP32_updated.ino`:

```cpp
// WiFi Configuration
#define WIFI_SSID "your_wifi_ssid"
#define WIFI_PASSWORD "your_wifi_password"

// Firebase Configuration  
#define FIREBASE_API_KEY "your_firebase_api_key"
#define FIREBASE_DATABASE_URL "your_firebase_database_url"
#define FIREBASE_USER_EMAIL "your_email@example.com"
#define FIREBASE_USER_PASSWORD "your_password"

// Connection Parameters
#define WIFI_RECONNECT_INTERVAL 30000    // WiFi reconnection interval
#define WIFI_RETRY_DELAY 5000           // Delay between WiFi retries
#define MAX_WIFI_RETRIES 10             // Max retries before system restart
```

#### ESP32-CAM Setup

1. **Install ESP32-CAM specific libraries**:
   - **"Firebase ESP Client"** by Mobizt
   - **"ArduinoJson"** by Benoit Blanchon (if not already installed)

2. **Configure credentials** in `espcam_firebase.ino`:

```cpp
// WiFi & NTP Configuration
const char* ssid = "your_wifi_ssid";
const char* password = "your_wifi_password";
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 19800;        // India timezone: UTC+5:30
const int daylightOffset_sec = 0;

// Firebase Configuration
#define FIREBASE_API_KEY "your_firebase_api_key"
#define FIREBASE_DATABASE_URL "your_firebase_database_url"
#define FIREBASE_USER_EMAIL "your_email@example.com"
#define FIREBASE_USER_PASSWORD "your_password"

// Photo Settings
unsigned long interval = 12 * 60 * 60 * 1000;      // Default 12 hours
const unsigned long MIN_INTERVAL = 15 * 60 * 1000; // 15 minutes minimum
const unsigned long MAX_INTERVAL = 48 * 60 * 60 * 1000; // 48 hours maximum
```

3. **Hardware Setup**:
   - Insert MicroSD card (Class 10, 8GB+ recommended)
   - Connect external WiFi antenna for better reception
   - Ensure stable 5V power supply (camera requires more power than regular ESP32)

4. **Configure SIM800L GPRS** (in `initSIM800L()` function):

```cpp
// Replace with your mobile carrier's APN
sim800.println("AT+SAPBR=3,1,\"APN\",\"your_carrier_apn\"");
```

5. **Adjust control thresholds** as needed:

```cpp
// Default threshold values
int moistureThreshold = 1500;           // Soil moisture (higher = drier)
float tempThreshold = 28.0;             // Temperature threshold (°C)

// Hysteresis values (prevent rapid switching)
const int MOISTURE_HYSTERESIS = 100;    // Moisture deadband
const float TEMP_HYSTERESIS = 0.5;      // Temperature deadband (°C)

// Memory monitoring thresholds
const unsigned long LOW_MEMORY_THRESHOLD = 40000;      // Low memory warning
const unsigned long CRITICAL_MEMORY_THRESHOLD = 20000; // Critical memory warning
```

6. **Set light schedule** (default values):

```cpp
String lightOnTimeStr = "07:00:00";   // Light on time
String lightOffTimeStr = "21:00:00";  // Light off time
```

7. **Upload code** to ESP32 and monitor serial output at 115200 baud

## System Operation

### Automatic Mode Features

The system operates in automatic mode by default (after 10-minute startup period):

#### Smart Irrigation System (5-Second Burst with Cooldown)
- **Zone-Based Control**: 
  - Pump 1 controls irrigation zones 1-2 (moisture sensors on GPIO32, 33)
  - Pump 2 controls irrigation zones 3-4 (moisture sensors on GPIO34, 35)
- **Burst Irrigation**: 5-second water bursts to prevent overwatering
- **Cooldown Protection**: 1-hour minimum gap between pump activations
- **Hysteresis Control**: Prevents rapid triggering with moisture deadband
- **Independent Operation**: Each pump operates independently based on its zones
- **Serial Logging**: All pump operations logged with detailed status messages

```cpp
// Pump control logic - 5-second bursts with 1-hour cooldown
const unsigned long PUMP_RUNTIME = 5000;        // 5 seconds pump runtime
const unsigned long PUMP_COOLDOWN = 3600000;    // 1 hour (3600 seconds) cooldown

// Pump activation conditions:
// 1. Soil moisture > (threshold + hysteresis) in any zone
// 2. At least 1 hour since last activation
// 3. System in automatic mode
// 4. Runs for exactly 5 seconds then stops automatically
```

#### Intelligent Ventilation (5-Minute Timer + Sensor Control)
- **Sensor-Based Activation**: Fan turns on when greenhouse temperature exceeds threshold
- **Timer-Based Operation**: Runs for 5 minutes every hour for air circulation
- **Dual Control Logic**: Sensor and timer operations work independently
- **Hysteresis Control**: Temperature deadband prevents rapid fan cycling
- **Smart Override**: Timer and sensor controls coordinate to avoid conflicts

```cpp
// Fan control with dual activation modes
const unsigned long FAN_INTERVAL = 3600000;    // 1 hour interval between timer runs
const unsigned long FAN_RUNTIME = 300000;      // 5 minutes timer runtime

// Fan activation logic:
// 1. Sensor mode: ON when temp > (threshold + hysteresis), OFF when temp < (threshold - hysteresis)
// 2. Timer mode: 5-minute run every hour regardless of temperature
// 3. Priority: Sensor control overrides timer control when needed
```

#### Scheduled Lighting
- **Time-Based Control**: Programmable on/off schedule
- **Overnight Support**: Handles schedules crossing midnight
- **Remote Configuration**: Schedule updates via Firebase

```cpp
// Light schedule examples
"07:00:00" to "21:00:00"  // Normal day schedule
"21:00:00" to "07:00:00"  // Overnight schedule
```

### Manual Mode Features

Switch to manual mode via Firebase for direct control:
- Individual relay control (pumps, fan, light)
- Override automatic thresholds
- Remote operation via web interface
- Immediate response to Firebase commands

### Safety & Reliability Features

#### Startup Safety Mode
- **10-minute manual mode** on system boot (STARTUP_MANUAL_DURATION = 10 * 60 * 1000ms)
- Prevents automatic activation during system initialization
- Allows manual testing of all components via Firebase
- Automatically switches to automatic mode after startup period
- Status messages indicate when startup mode completes

#### Connection Redundancy
- **Primary WiFi** with automatic reconnection
- **GPRS Backup** via SIM800L when WiFi fails
- **Automatic Failover** between connection types
- **System Restart** after multiple connection failures

#### System Monitoring & Health
- **Memory Usage Tracking**: Monitors free heap memory with lowest heap tracking
- **Low Memory Warnings**: Alerts at 40KB (warning) and 20KB (critical) thresholds
- **Connection Status**: Reports WiFi/GPRS connection type and IP address
- **Sensor Validation**: Handles NaN values and disconnected sensors gracefully
- **Time Synchronization**: NTP client with non-blocking sync and retry mechanism
- **Firebase Session Management**: Automatic reconnection on session loss
- **System Warnings**: Firebase logging of memory and connection issues

## ESP32-CAM Features

### Time-Lapse Photography System
- **Configurable Intervals**: 15 minutes to 48 hours between photos
- **Offline Storage**: Automatic SD card backup when WiFi unavailable
- **Auto-Upload**: Queued photos upload when connection restored
- **Flash Control**: Built-in LED flash with manual toggle
- **Settings Persistence**: Photo interval and flash state saved to flash memory
- **Base64 Encoding**: Photos encoded for Firebase storage
- **Timestamp Integration**: NTP synchronized timestamps with IST timezone
- **Error Recovery**: Automatic restart on camera failures

### ESP32-CAM Operation Modes
```cpp
// Photo capture triggers
1. Automatic interval-based capture (configurable via Firebase)
2. Manual capture via Firebase command
3. Startup photo after successful connection

// Storage strategy
1. Primary: Direct upload to Firebase when WiFi connected
2. Backup: Save to SD card when offline
3. Recovery: Upload queued photos when connection restored

// Command processing
- takePhoto: Immediate photo capture
- toggleFlash: LED flash on/off control  
- setInterval: Adjust photo interval (15min - 48hrs)
```

### ESP32-CAM Serial Output
```
--- ESP32-CAM Firebase & SD Card Logger (Stable Version) ---
--- Loaded Settings ---
Interval: 43200000 ms
Flash State: OFF
-----------------------
Initializing SD Card...
SUCCESS: SD Card initialized.
WiFi connected
IP address: 192.168.1.100
NTP time synchronized successfully!
SUCCESS: Firebase connected.
Status update successful.
--- Starting Photo Capture Process ---
Photo captured successfully. Size: 87432 bytes
WiFi Connected. Uploading directly to Firebase.
SUCCESS: Photo uploaded to Firebase.
--- Photo Capture Process Finished ---
```

## Firebase Database Structure

The system uses Firebase Realtime Database with this structure:

```json
{
  "greenhouse": {
    "sensors": {
      "temperature": [25.5, 26.1, 22.3],      // [Greenhouse1, Greenhouse2, Outside]
      "humidity": [65.2, 68.1, 45.7],         // [Greenhouse1, Greenhouse2, Outside]
      "moisture": [1200, 1350, 1180, 1420],   // [Zone1, Zone2, Zone3, Zone4]
      "soilTemp": [24.2, 23.8],               // [Sensor1, Sensor2]
      "avgGreenhouseTemp": 25.8,              // Calculated average
      "avgGreenhouseHumidity": 66.7,          // Calculated average
      "outsideTemp": 22.3,                    // Outside temperature
      "outsideHumidity": 45.7,                // Outside humidity
      "lastUpdate": 1234567890000,            // Timestamp
      "memory": 180000,                       // Free heap memory
      "connectionType": "WiFi"                // WiFi or GPRS
    },
    "relays": {
      "pump1": false,                         // Pump 1 status (zones 1-2)
      "pump2": true,                          // Pump 2 status (zones 3-4)
      "fan": false,                           // Fan status
      "light": true                           // Light status
    },
    "thresholds": {
      "moisture": 1500,                       // Soil moisture threshold
      "temperature": 28.0,                    // Temperature threshold (°C)
      "lightOn": "07:00:00",                 // Light on time
      "lightOff": "21:00:00"                 // Light off time
    },
    "mode": {
      "automatic": true                       // Auto/Manual mode flag
    },
    "status": {
      "isOnline": true,                       // ESP32 online status
      "ipAddress": "192.168.1.100",          // Current IP address
      "lastSeen": 1234567890000,              // Last communication timestamp
      "startTime": 1234567800000,             // System start timestamp
      "version": "2.1",                       // Firmware version
      "freeHeap": 180000,                     // Available memory
      "connectionType": "WiFi"                // Current connection type
    },
    "system": {
      "memory": {
        "freeHeap": 180000,                   // Current free memory
        "lowestHeap": 165000,                 // Lowest recorded memory
        "timestamp": 1234567890000            // Last memory check
      }
    },
    "warnings": {
      "1234567890": {                         // Warning ID (timestamp)
        "type": "MEMORY",                     // Warning type
        "level": "WARNING",                   // Severity level
        "value": 35000,                       // Related value
        "message": "Memory running low",      // Warning message
        "timestamp": 1234567890000            // Warning timestamp
      }
    },
    "history": {
      "1234567890000": {                      // Historical data point
        "timestamp": 1234567890000,
        "datetimeUpdate": "2024-01-15 14:30:00",
        "temperature0": 25.5,                 // Greenhouse sensor 1
        "temperature1": 26.1,                 // Greenhouse sensor 2
        "temperature2": 22.3,                 // Outside sensor
        "humidity0": 65.2,                    // Greenhouse sensor 1
        "humidity1": 68.1,                    // Greenhouse sensor 2
        "humidity2": 45.7,                    // Outside sensor
        "moisture0": 1200,                    // Zone 1
        "moisture1": 1350,                    // Zone 2
        "moisture2": 1180,                    // Zone 3
        "moisture3": 1420,                    // Zone 4
        "soilTemp0": 24.2,                    // Soil sensor 1
        "soilTemp1": 23.8,                    // Soil sensor 2
        "avgGreenhouseTemp": 25.8,           // Average greenhouse temp
        "avgGreenhouseHumidity": 66.7        // Average greenhouse humidity
      }
    }
  },
  "commands": {
    "id": "1234567890",                    // Command ID (timestamp)
    "type": "takePhoto",                   // Command type: takePhoto, toggleFlash, setInterval
    "data": "6.0",                         // Optional data (e.g., interval hours)
    "timestamp": 1234567890000             // Command timestamp
  },
  "status": {
    "flashState": "OFF",                   // Flash LED state
    "photoIntervalHours": "12.0",          // Photo interval in hours
    "lastUpdate": "Jan 15, 2024 14:30:00", // Last status update
    "ipAddress": "192.168.1.101",         // ESP32-CAM IP address
    "lastPhotoTime": 1234567890000         // Last photo capture timestamp
  },
  "photos": {
    "photo_1234567890": {                  // Photo ID (timestamp)
      "timestamp": 1234567890000,          // Photo timestamp (JavaScript format)
      "imageData": "data:image/jpeg;base64,/9j/4AAQ...", // Base64 encoded image
      "caption": "Jan 15, 2024 14:30:00"  // Formatted date caption
    }
  }
}
```

### Data Update Intervals

```cpp
// Firebase and system update intervals
const unsigned long FIREBASE_UPDATE_INTERVAL = 5000;   // Firebase sync every 5 seconds
const unsigned long HISTORY_UPDATE_INTERVAL = 60000;   // Historical data every 60 seconds
const unsigned long STATUS_UPDATE_INTERVAL = 15000;    // ESP32 status every 15 seconds
const unsigned long SENSOR_READ_INTERVAL = 2000;       // Internal sensor reading every 2 seconds
const unsigned long WIFI_CHECK_INTERVAL = 10000;       // Connection health check every 10 seconds
const unsigned long NTP_RETRY_INTERVAL = 30000;        // NTP sync retry every 30 seconds
```

## Serial Monitor Output

The system provides comprehensive serial output for monitoring and debugging:

### System Status Messages
```
SmartSprout v2.1 - SHT30/DS18B20/SIM800L
Initializing SHT30 sensors...
Found SHT30 greenhouse sensor 1.
Found SHT30 greenhouse sensor 2.
Found SHT30 outside sensor.
Time synchronized successfully!
System started - Manual mode for 10 minutes
Startup manual mode finished. Switching to Automatic Mode.

SmartSprout Status
Mode: Auto
Connection: WiFi
Free Heap: 180000 bytes
Soil Moisture: 1200, 1350, 1180, 1420
Soil Temp: 24.2°C, 23.8°C
Greenhouse Temp: 25.8°C
Greenhouse Humidity: 66.7%
Outside Temp: 22.3°C
Outside Humidity: 45.7%
Pumps: OFF/ON
Fan: OFF
Lights: ON
```

### Actuator Control Messages
```
=== Pump 1 turned ON for 5-second burst (Zones 1-2 need water) ===
=== Pump 1 turned OFF after 5-second burst ===
=== Pump 2 turned ON for 5-second burst (Zones 3-4 need water) ===
=== Pump 2 turned OFF after 5-second burst ===
=== Fan turned ON due to sensor thresholds ===
=== Fan turned ON by timer override ===
=== Fan timer override ended, fan turned OFF ===
=== Fan timer override ended, but fan remains ON due to sensor readings ===
Lights turned ON by automatic schedule
Lights turned OFF by automatic schedule
Mode changed via Firebase to: Automatic
Pump 1 changed via Firebase to: ON
Fan changed via Firebase to: OFF
```

### Connection Status Messages
```
Attempting GPRS connection...
GPRS connected successfully
GPRS connection failed
WiFi reconnected successfully
Firebase session lost. Attempting to reconnect...
Firebase reconnected successfully.
Failed to reconnect to Firebase. REASON: [error details]
Retrying NTP time synchronization...
Background NTP sync successful!
No internet connection available. Restarting...
WARNING: Failed to synchronize time on startup. Will retry in the background.
```

## Troubleshooting Guide

### Hardware Issues

| Problem | Symptoms | Solution |
|---------|----------|----------|
| **No sensor readings** | All sensors show 0 or invalid values | Check 3.3V power supply and sensor connections |
| **Erratic moisture readings** | Values jumping rapidly | Check sensor placement and soil contact |
| **SHT30 not responding** | Temperature/humidity show 0 | Verify I2C connections (SDA=21, SCL=22) |
| **DS18B20 not found** | Soil temperature shows -127°C | Check OneWire connection and 4.7kΩ pullup resistor |
| **Relays not switching** | Devices don't respond to commands | Verify 5V power to relay module and connections |

### Software Issues

| Problem | Symptoms | Solution |
|---------|----------|----------|
| **WiFi won't connect** | "WiFi connection failed" messages | Check SSID/password, signal strength, router settings |
| **Firebase not updating** | Data not appearing in database | Verify API key, database URL, and authentication |
| **GPRS connection fails** | SIM800L errors in serial output | Check SIM card, APN settings, antenna connection |
| **Memory warnings** | Low heap messages | Monitor for memory leaks, restart system if needed |
| **System restarts** | Frequent reboots | Check power supply stability and connection reliability |

### Diagnostic Steps

1. **Check Serial Monitor** (115200 baud) for error messages
2. **Verify Power Supply**: Ensure stable 3.3V, 5V, and 12V rails
3. **Test Sensors Individually**: Use simple test sketches to isolate issues
4. **Check Firebase Rules**: Ensure read/write permissions are set correctly
5. **Monitor Memory Usage**: Watch for memory leaks and low heap warnings
6. **Validate Network**: Test both WiFi and GPRS connections separately

### Advanced Debugging

#### Enable Detailed Logging
```cpp
// Add to setup() for more verbose output
Serial.setDebugOutput(true);
```

#### Memory Monitoring
```cpp
// Current implementation tracks:
unsigned long currentHeap = ESP.getFreeHeap();
if (currentHeap < LOW_MEMORY_THRESHOLD) {
    Serial.println("WARNING: Low memory detected");
}
```

#### Connection Testing
```cpp
// Test WiFi connection
WiFi.begin(ssid, password);
while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
}

// Test GPRS connection  
sim800.println("AT+CGATT?");
if (sim800.find("+CGATT: 1")) {
    Serial.println("GPRS attached");
}
```

## Performance Specifications

### System Capabilities
- **Sensor Update Rate**: 2-second internal reading cycle
- **Firebase Sync**: 5-second data upload interval  
- **Historical Logging**: 60-second data archival with timestamp
- **Connection Monitoring**: 10-second health checks with automatic failover
- **Memory Usage**: ~180KB free heap (typical), with low memory warnings
- **Power Consumption**: ~200mA @ 3.3V (ESP32 + sensors)
- **Time Accuracy**: NTP synchronized with IST timezone (+5:30 UTC)
- **Startup Time**: ~30-60 seconds including sensor initialization and Firebase auth

### Operating Ranges
- **Temperature Monitoring**: -40°C to +85°C (SHT30), -55°C to +125°C (DS18B20)
- **Humidity Monitoring**: 0-100% RH (SHT30)
- **Soil Moisture**: 0-4095 (12-bit ADC)
- **Relay Switching**: 10A @ 250VAC, 10A @ 30VDC

## Advanced Configuration

### Custom Threshold Settings
```cpp
// Default threshold values (can be updated via Firebase)
int moistureThreshold = 1500;        // Soil moisture trigger point (higher = drier)
float tempThreshold = 28.0;          // Temperature trigger (°C)
String lightOnTimeStr = "07:00:00";  // Light on time (24-hour format)
String lightOffTimeStr = "21:00:00"; // Light off time (24-hour format)

// Hysteresis prevents rapid switching
const int MOISTURE_HYSTERESIS = 100;  // ±100 moisture units deadband
const float TEMP_HYSTERESIS = 0.5;    // ±0.5°C temperature deadband

// Memory monitoring thresholds
const unsigned long LOW_MEMORY_THRESHOLD = 40000;      // Warning threshold
const unsigned long CRITICAL_MEMORY_THRESHOLD = 20000; // Critical threshold
```

### Timing Adjustments
```cpp
// Update intervals (milliseconds)
const unsigned long FIREBASE_UPDATE_INTERVAL = 5000;   // Firebase sync every 5 seconds
const unsigned long SENSOR_READ_INTERVAL = 2000;       // Internal sensor reading every 2 seconds
const unsigned long HISTORY_UPDATE_INTERVAL = 60000;   // Historical data logging every 60 seconds
const unsigned long STATUS_UPDATE_INTERVAL = 15000;    // ESP32 status update every 15 seconds
const unsigned long WIFI_CHECK_INTERVAL = 10000;       // Connection check every 10 seconds

// Pump control settings
const unsigned long PUMP_RUNTIME = 5000;       // 5 seconds pump burst
const unsigned long PUMP_COOLDOWN = 3600000;   // 1 hour cooldown between activations

// Fan timer settings
const unsigned long FAN_INTERVAL = 3600000;    // 1 hour between timer runs
const unsigned long FAN_RUNTIME = 300000;      // 5 minutes timer run duration

// Safety and connection settings
const unsigned long STARTUP_MANUAL_DURATION = 10 * 60 * 1000;  // 10 minutes startup delay
const unsigned long NTP_RETRY_INTERVAL = 30000;                // NTP sync retry every 30 seconds
const unsigned long WIFI_RETRY_DELAY = 5000;                   // WiFi retry delay
```

### SIM800L APN Configuration
```cpp
// Common APN settings by carrier
// Verizon: "vzwinternet"
// AT&T: "broadband" 
// T-Mobile: "fast.t-mobile.com"
// Replace in initSIM800L() function:
sim800.println("AT+SAPBR=3,1,\"APN\",\"your_carrier_apn\"");
```

## Expansion Options

### Additional Sensors
- **pH Sensors**: Monitor soil acidity
- **Light Sensors**: Measure PAR/PPFD for plants
- **Water Level**: Tank monitoring for irrigation
- **Weather Station**: Wind, rain, pressure sensors

### Additional Actuators
- **Heaters**: Temperature control in cold climates
- **Misters**: Humidity control systems
- **Dosing Pumps**: Nutrient injection systems
- **Motorized Vents**: Automated greenhouse ventilation

### Communication Upgrades
- **LoRaWAN**: Long-range, low-power communication
- **Ethernet**: Wired network connection
- **Bluetooth**: Local device pairing
- **Satellite**: Remote location connectivity

## Contributing

We welcome contributions to improve the SmartSprout system:

### Areas for Enhancement
- **Machine Learning**: Predictive plant care algorithms
- **Energy Monitoring**: Power consumption tracking
- **Weather Integration**: API-based weather forecasting
- **Mobile App**: Native iOS/Android applications
- **Advanced Scheduling**: Complex automation rules

### Development Guidelines
1. **Test thoroughly** with actual hardware
2. **Document changes** in code comments
3. **Maintain compatibility** with existing Firebase structure
4. **Follow Arduino coding standards**
5. **Include troubleshooting information**

## License

This project is open-source and available under the MIT License for personal, educational, and commercial use.

## Support & Community

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Comprehensive setup and troubleshooting guides
- **Serial Monitor**: Real-time system diagnostics at 115200 baud
- **Firebase Console**: Live data monitoring and system control

## Dual Module Communication

The two ESP32 modules communicate through Firebase Realtime Database:

### Main Controller → Firebase
- Sensor data updates every 5 seconds
- Relay status changes
- System health and memory status
- Historical data logging every 60 seconds

### ESP32-CAM → Firebase  
- Photo uploads with Base64 encoding
- Status updates (flash state, interval, IP address)
- Command acknowledgment and processing
- Offline photo queue management

### Web App ↔ Firebase
- Real-time sensor data display
- Camera control commands (photo, flash, interval)
- Photo gallery with download/delete functions
- System configuration and threshold updates

## Recent Updates (v2.1)

### Main Controller Improvements
- **Enhanced Pump Control**: 5-second burst irrigation with 1-hour cooldown protection
- **Dual I2C Bus Support**: Separate buses for greenhouse and outside sensors
- **Improved Fan Logic**: Independent sensor and timer-based control with hysteresis
- **Memory Monitoring**: Real-time heap tracking with warning system
- **Non-blocking NTP**: Background time synchronization with retry mechanism
- **Firebase Session Management**: Automatic reconnection on authentication loss
- **Startup Safety Mode**: 10-minute manual mode on boot for safe initialization
- **Enhanced Logging**: Detailed serial output for all system operations

### ESP32-CAM Improvements
- **Settings Persistence**: Photo interval and flash state saved to flash memory
- **Offline Storage**: Automatic SD card backup when WiFi unavailable
- **Auto-Upload Queue**: Queued photos upload when connection restored
- **Error Recovery**: Automatic restart on camera capture failures
- **NTP Integration**: IST timezone synchronized timestamps
- **Base64 Optimization**: Efficient photo encoding for Firebase storage
- **Command Processing**: Real-time command handling from Firebase

### Bug Fixes
- Fixed I2C conflicts by moving fan to GPIO23
- Resolved NaN sensor value handling in Firebase updates
- Improved connection stability with better error handling
- Enhanced memory management to prevent heap fragmentation
- Fixed ESP32-CAM brownout issues with proper power management
- Resolved SD card initialization failures with better error handling

## Upload Instructions

### Main Controller Upload
1. Connect ESP32 development board via USB
2. Select **ESP32 Dev Module** in Arduino IDE
3. Upload `FirebaseESP32_updated.ino`
4. Monitor serial output at 115200 baud
5. Verify sensor initialization and Firebase connection

### ESP32-CAM Upload
1. Connect ESP32-CAM with FTDI programmer
2. Hold BOOT button while connecting power
3. Select **AI Thinker ESP32-CAM** in Arduino IDE
4. Upload `espcam_firebase.ino`
5. Remove FTDI and power cycle
6. Monitor serial output at 115200 baud
7. Verify camera initialization and SD card detection

### Post-Upload Verification
```
Main Controller Checklist:
✓ SHT30 sensors detected (3 sensors)
✓ DS18B20 sensors initialized (2 sensors)
✓ WiFi connection established
✓ Firebase authentication successful
✓ NTP time synchronization
✓ Relay initialization complete

ESP32-CAM Checklist:
✓ Camera initialization successful
✓ SD card detected and mounted
✓ WiFi connection established
✓ Firebase authentication successful
✓ NTP time synchronization
✓ Settings loaded from flash memory
```

---

**SmartSprout v2.1** - Advanced Greenhouse Automation System  
*Reliable • Intelligent • Open Source*

**Features**: Dual ESP32 architecture • 5-second burst irrigation • Time-lapse photography • Offline storage • Dual connectivity • Real-time monitoring • Smart scheduling • Memory protection