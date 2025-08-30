# Smart Sprout Monitor

A comprehensive plant monitoring system using ESP32, sensors, and a React web application to view sensor data, control environmental parameters, and monitor your plants through photos.

## Project Overview

The Smart Sprout Monitor is a comprehensive greenhouse automation system combining two ESP32 modules and a React web application:

**Main Controller**: Monitors environmental conditions and controls irrigation, ventilation, and lighting
**ESP32-CAM Module**: Captures time-lapse photos with offline storage capability
**Web Dashboard**: Real-time monitoring, control, and historical data visualization

Key capabilities:
1. Monitor greenhouse conditions (temperature, humidity, soil moisture, soil temperature)
2. Automated irrigation with smart pump control and cooldown periods
3. Temperature-based fan control with timer override
4. Scheduled grow light automation
5. Time-lapse plant photography with offline backup
6. Dual connectivity (WiFi + GPRS backup)
7. Historical data logging and alert system

## Features

### Web Application

- **Dashboard**: Real-time display of all sensor data
  - Temperature: 2 greenhouse sensors + 1 outside sensor
  - Humidity: 2 greenhouse sensors + 1 outside sensor  
  - Soil Moisture: 4 zone monitoring
  - Soil Temperature: 2 sensor monitoring
- **Camera Control**: ESP32-CAM integration
  - Take photos on demand
  - Toggle LED flash for better lighting
  - Adjust photo interval (15 min to 48 hours)
  - Automatic offline storage with SD card backup
- **Photo Gallery**: View, download, and delete time-lapse photos
- **Smart Control Panel**: 
  - Automatic mode with intelligent thresholds
  - Manual override capability
  - Pump control with burst irrigation and cooldown
  - Fan control with temperature thresholds and timer override
  - Scheduled grow light automation
- **Historical Data**: Interactive charts with 1H/24H/7D/30D views
- **Alert System**: Configurable thresholds with email notifications

### ESP32 Hardware

#### Main Controller (FirebaseESP32_updated.ino)
- **Environmental Monitoring**: 
  - SHT30 sensors for temperature/humidity (2 greenhouse + 1 outside)
  - DS18B20 sensors for soil temperature monitoring (2 sensors)
  - 4 soil moisture sensors for different zones
- **Automated Control**: 
  - 2 water pumps with 5-second burst control and 1-hour cooldown
  - Fan control with temperature thresholds and timer override
  - Automated light scheduling with configurable on/off times
- **Connectivity**: WiFi primary with SIM800L GPRS backup
- **Smart Features**: 
  - Automatic/Manual mode switching
  - Hysteresis control to prevent relay chattering
  - 10-minute startup manual mode for system initialization

#### ESP32-CAM Module (espcam_firebase.ino)
- **Photography**: Configurable intervals from 15 minutes to 48 hours
- **Flash Control**: Built-in LED flash with manual toggle
- **Offline Storage**: SD card backup when WiFi is unavailable
- **Auto-Upload**: Queued photos upload when connection restored
- **Settings Persistence**: Flash memory storage for interval and flash state

## Technologies Used

### Web Application
- React with TypeScript
- Vite for fast development
- Tailwind CSS with shadcn/ui components
- Firebase Realtime Database for backend
- date-fns for date/time handling
- React Query for data fetching
- Sonner and React Hot Toast for notifications

### Hardware

#### Main ESP32 Controller
- ESP32 development board
- 3x SHT30 I2C temperature/humidity sensors (2 greenhouse, 1 outside)
- 2x DS18B20 1-Wire soil temperature sensors
- 4x analog soil moisture sensors
- 2x water pump relays (5V relay module)
- 1x fan relay (5V relay module)  
- 1x grow light relay (5V relay module)
- SIM800L GPRS module for backup connectivity
- I2C multiplexing using two separate I2C buses

#### ESP32-CAM Module
- ESP32-CAM board (AI-Thinker model)
- Built-in camera with flash LED
- MicroSD card for offline photo storage
- External antenna for better WiFi reception

## Getting Started

### Web Application Setup

1. Clone the repository:

```sh
git clone <repository-url>
cd smart-sprout-monitor
```

2. Install dependencies:

```sh
npm install
```

3. Run the development server:

```sh
npm run dev
```

4. Open your browser to the displayed URL (usually http://localhost:5173)

### ESP32 Hardware Setup

#### Main Controller Setup (FirebaseESP32_updated.ino)

1. Install required libraries in Arduino IDE:
   - ESP32 board support
   - Firebase ESP Client
   - ArduinoJson
   - Adafruit SHT31 library
   - OneWire library
   - DallasTemperature library
   - NTPClient library

2. Pin Configuration:
   ```
   Soil Moisture: GPIO 32, 33, 34, 35
   Water Pumps: GPIO 16, 17
   Fan: GPIO 23
   Lights: GPIO 27
   DS18B20 Soil Temp: GPIO 4, 5
   I2C Bus 1 (Greenhouse): SDA=21, SCL=22
   I2C Bus 2 (Outside): SDA=18, SCL=19
   SIM800L: TX=26, RX=25
   ```

3. Configure credentials in the code:
   - WiFi SSID and password
   - Firebase API key and database URL
   - Firebase user email and password
   - SIM800L APN settings

#### ESP32-CAM Setup (espcam_firebase.ino)

1. Install required libraries:
   - ESP32 board support
   - Firebase ESP Client
   - ArduinoJson

2. Hardware connections (AI-Thinker model):
   - Flash LED: GPIO 4
   - Camera pins: Pre-configured for AI-Thinker model
   - MicroSD card slot: Built-in

3. Configure in code:
   - WiFi credentials
   - Firebase credentials
   - Photo interval (default 12 hours)
   - Flash LED initial state

## Usage

### Main Dashboard

- View real-time sensor readings
- Control pumps, fans, and lights manually or set to automatic mode
- View system status and last update time

### Camera Controls

- **Take Photo**: Capture a new photo immediately
- **Toggle Flash**: Turn the LED flash on/off for better lighting
- **Photo Interval**: Configure automatic photo frequency (15 min to 48 hours)
- **Gallery**: Browse through all photos with timestamps

### Settings & Configuration

- **Alert Thresholds**: Configure limits for temperature, humidity, soil moisture, and soil temperature
- **Email Notifications**: Set up alerts when thresholds are exceeded
- **Irrigation Control**: Adjust soil moisture thresholds for automatic watering
- **Climate Control**: Set temperature thresholds for fan activation
- **Light Schedule**: Configure automated grow light on/off times
- **Camera Settings**: Adjust photo intervals and flash preferences
- **System Mode**: Switch between automatic and manual control modes

## Firebase Configuration

The system uses Firebase Realtime Database with the following structure:

### Main Controller Data
- `/greenhouse/sensors`: Real-time sensor readings
  - `temperature[0-2]`: Greenhouse and outside temperature
  - `humidity[0-2]`: Greenhouse and outside humidity
  - `moisture[0-3]`: 4-zone soil moisture readings
  - `soilTemperature[0-1]`: Soil temperature sensors
- `/greenhouse/relays`: Current relay states (pump1, pump2, fan, light)
- `/greenhouse/thresholds`: User-configurable thresholds
  - `moisture`: Soil moisture threshold for irrigation
  - `temperature`: Temperature threshold for fan activation
  - `lightOn/lightOff`: Automated lighting schedule
- `/greenhouse/mode`: Automatic/Manual mode setting
- `/greenhouse/status`: System health and connectivity
- `/greenhouse/history`: Time-series data for charts
- `/greenhouse/alerts`: Alert configuration and email settings

### ESP32-CAM Data
- `/photos`: Time-lapse photo storage with Base64 encoding
- `/commands`: Command queue for ESP32-CAM
  - `takePhoto`: Immediate photo capture
  - `toggleFlash`: LED flash control
  - `setInterval`: Photo interval adjustment
- `/status`: ESP32-CAM status and configuration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

