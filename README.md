# Smart Sprout Monitor

A comprehensive plant monitoring system using ESP32, sensors, and a React web application to view sensor data, control environmental parameters, and monitor your plants through photos.

## Project Overview

The Smart Sprout Monitor combines hardware (ESP32 with environmental sensors) and a web application to:

1. Monitor plant environmental conditions (temperature, humidity, moisture, CO2)
2. Take periodic photos of your plants
3. Control relays for automated plant care (pumps, fans, lights)
4. View historical data and set up alerts for critical conditions

## Features

### Web Application

- **Dashboard**: Real-time display of all sensor data (temperature, humidity, moisture, CO2)
- **Camera Control**: Take photos on demand, toggle LED flash, adjust photo interval
- **Photo Gallery**: View, download, and delete photos captured by the ESP32-CAM
- **Control Panel**: Manual or automatic control of pumps, fans, and grow lights
- **Historical Data**: Track environmental conditions over time with interactive charts
- **Alert System**: Email notifications when sensor readings exceed thresholds

### ESP32 Hardware

- **Environmental Monitoring**: Temperature, humidity, moisture, and CO2 sensors
- **Automated Photography**: Configurable photo intervals from 15 minutes to 48 hours
- **Relay Control**: Manage pumps, fans, and grow lights
- **Firebase Integration**: Real-time data syncing and photo storage
- **Internet Connectivity**: Wi-Fi connection with IP address reporting

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
- ESP32 module
- DHT22/AM2302 temperature/humidity sensors
- Soil moisture sensors
- CO2 sensor
- Relay module for controlling devices

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

### ESP32-CAM Setup

1. Install the required libraries in Arduino IDE:
   - ESP32 board support
   - Firebase ESP Client
   - ArduinoJson
   - DHT sensor library

2. Configure the ESP32 code with your:
   - WiFi credentials
   - Firebase credentials
   - Sensor pin assignments
   - Preferred settings (photo interval, thresholds)

3. Upload the code to your ESP32 and connect sensors

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

### Settings

- Configure alert thresholds for temperature, moisture, and CO2
- Set up email notifications
- Configure light schedule
- Adjust system parameters

## Firebase Configuration

The system uses Firebase Realtime Database with the following structure:

- `/greenhouse/sensors`: Contains all sensor readings
- `/greenhouse/relays`: Status of pumps, fans, and lights
- `/greenhouse/thresholds`: User-defined alert thresholds
- `/greenhouse/status`: System status and connection information
- `/greenhouse/history`: Historical sensor data for charts
- `/photos`: Stores plant photos with timestamps
- `/commands`: Used for sending commands to the ESP32-CAM
- `/status`: Contains the current status of the ESP32-CAM

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

