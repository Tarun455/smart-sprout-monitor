# SmartSprout ESP32 Code Documentation

This directory contains the Arduino code for the SmartSprout Greenhouse Monitoring System. The system uses ESP32 microcontrollers to monitor environmental conditions, control greenhouse equipment, and capture plant growth images.

## System Overview

The SmartSprout system consists of two main ESP32 components:

1. **Main ESP32 Controller** (`FirebaseESP32_updated.ino`): Handles sensor readings, equipment control, and data transmission to Firebase.
2. **ESP32-CAM Module** (`espcam_firebase.ino`): Captures periodic images of plants and uploads them to Firebase for growth monitoring.

Both components connect to the same Firebase Realtime Database to provide a complete greenhouse monitoring and control solution.

## FirebaseESP32_updated.ino

### Features

- **Sensor Monitoring**:
  - Soil moisture monitoring (4 separate zones)
  - Temperature and humidity monitoring (2 DHT22 sensors)
  - CO₂ level monitoring (MQ135 sensor)

- **Equipment Control**:
  - Water pumps (2 separate pumps for different zones)
  - Ventilation fan
  - Grow lights

- **Operating Modes**:
  - Automatic mode: Controls equipment based on sensor thresholds
  - Manual mode: Allows remote control via Firebase

- **Smart Features**:
  - Hysteresis control to prevent rapid relay switching
  - Time-based light scheduling
  - Periodic fan operation for air circulation
  - NTP time synchronization
  - Detailed status reporting

### Hardware Requirements

- ESP32 development board
- DHT22 temperature/humidity sensors (2x)
- Soil moisture sensors (4x)
- MQ135 air quality sensor
- Relay module (4-channel minimum)
- Water pumps (2x)
- Ventilation fan
- Grow lights
- Power supply

### Pin Configuration

```
// Soil moisture sensor pins
const int SOIL_MOISTURE_PINS[] = {32, 33, 34, 35};

// Water pump relay pins
const int WATER_PUMP_PINS[] = {16, 17};

// DHT sensor pins
const int DHT_PINS[] = {18, 19};

// MQ135 sensor analog pin
const int MQ_PIN = 36;

// Fan relay pin
const int FAN_PIN = 21;

// Light relay pin
const int LIGHT_PIN = 27;
```

### Setup Instructions

1. Install the required libraries:
   - Firebase ESP Client
   - DHT sensor library
   - WiFi
   - NTPClient
   - ArduinoJson
   - MQ135

2. Update WiFi and Firebase credentials in the code:
   ```cpp
   #define WIFI_SSID "your_wifi_ssid"
   #define WIFI_PASSWORD "your_wifi_password"
   #define FIREBASE_API_KEY "your_firebase_api_key"
   #define FIREBASE_DATABASE_URL "your_firebase_database_url"
   #define FIREBASE_USER_EMAIL "your_email@example.com"
   #define FIREBASE_USER_PASSWORD "your_password"
   ```

3. Adjust threshold values if needed:
   ```cpp
   int moistureThreshold = 1500;    // Soil moisture threshold
   float tempThreshold = 28.0;      // Temperature threshold in °C
   int co2Threshold = 800;          // CO₂ threshold in ppm
   ```

4. Upload the code to your ESP32 board

## espcam_firebase.ino

### Features

- **Image Capture**:
  - Automatic periodic image capture
  - Manual image capture via Firebase commands
  - Flash control for better image quality

- **Firebase Integration**:
  - Uploads images to Firebase Realtime Database
  - Stores images with timestamps
  - Responds to remote commands

- **Configuration**:
  - Adjustable image capture interval
  - Flash control
  - Status reporting

### Hardware Requirements

- ESP32-CAM module (AI-Thinker model recommended)
- External power supply
- FTDI programmer for uploading code

### Pin Configuration

```
// Flash LED pin
#define FLASH_LED_PIN 4

// Camera pins are pre-configured for AI-Thinker ESP32-CAM module
```

### Setup Instructions

1. Install the required libraries:
   - ESP32 Camera
   - Firebase ESP Client
   - WiFi

2. Update WiFi and Firebase credentials in the code:
   ```cpp
   const char* ssid = "your_wifi_ssid";
   const char* password = "your_wifi_password";
   #define FIREBASE_API_KEY "your_firebase_api_key"
   #define FIREBASE_DATABASE_URL "your_firebase_database_url"
   #define FIREBASE_USER_EMAIL "your_email@example.com"
   #define FIREBASE_USER_PASSWORD "your_password"
   ```

3. Adjust the photo capture interval if needed:
   ```cpp
   // Default interval is 12 hours (in milliseconds)
   unsigned long interval = 12 * 60 * 60 * 1000;
   ```

4. Connect the ESP32-CAM to an FTDI programmer:
   - Connect GPIO 0 to GND before powering up (to enter programming mode)
   - After uploading, disconnect GPIO 0 from GND and reset

5. Upload the code to your ESP32-CAM module

## Firebase Database Structure

The system uses the following Firebase Realtime Database structure:

```
/
├── sensor_data/
│   ├── moisture/
│   │   ├── section1
│   │   ├── section2
│   │   ├── section3
│   │   └── section4
│   ├── temperature
│   ├── humidity
│   └── co2
├── control/
│   ├── automatic_mode
│   ├── pump1
│   ├── pump2
│   ├── fan
│   ├── light
│   ├── thresholds/
│   │   ├── moisture
│   │   ├── temperature
│   │   └── co2
│   └── light_schedule/
│       ├── on_time
│       └── off_time
├── status/
│   └── last_update
├── history/
│   └── [timestamp]
├── commands/
│   └── take_photo
└── photos/
    └── [photo_id]/
        ├── timestamp
        ├── imageData
        └── caption
```

## Troubleshooting

### Common Issues

1. **WiFi Connection Problems**:
   - Ensure WiFi credentials are correct
   - Check if the ESP32 is within range of the WiFi router
   - The system will automatically attempt to reconnect if WiFi is lost

2. **Firebase Connection Issues**:
   - Verify Firebase credentials are correct
   - Ensure Firebase rules allow read/write access
   - Check if the Firebase project is active

3. **Sensor Reading Errors**:
   - Check sensor connections
   - Verify power supply is stable
   - The system implements error handling for invalid sensor readings

4. **ESP32-CAM Upload Problems**:
   - Make sure GPIO 0 is connected to GND during programming
   - Use an external 5V power supply (USB may not provide enough power)
   - Disconnect GPIO 0 from GND after programming and reset the board

### Debugging

Both code files include extensive serial output for debugging. Connect to the Serial Monitor at 115200 baud to view system status and error messages.

## License

This project is open-source and available for personal and educational use.

## Credits

Developed for the SmartSprout Greenhouse Monitoring System.