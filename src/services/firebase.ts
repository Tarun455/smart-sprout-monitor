import { initializeApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  onValue, 
  set, 
  update, 
  serverTimestamp, 
  query, 
  orderByChild, 
  limitToLast, 
  DatabaseReference,
  DataSnapshot,
  push,
  remove
} from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { toast } from "react-hot-toast";

// Firebase configuration from the ESP32 code
const firebaseConfig = {
  apiKey: "your_firebase_api_key",
  databaseURL: "your_firebase_database_url",
  projectId: "your_project_id",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// Track authentication state
let isAuthenticated = false;

// Helper function to ensure authentication before accessing data
export function ensureAuthentication(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isAuthenticated) {
      resolve();
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        isAuthenticated = true;
        resolve();
      } else {
        signInAnonymously(auth)
          .then(() => {
            isAuthenticated = true;
            console.log('Signed in anonymously to Firebase');
            resolve();
          })
          .catch((error) => {
            console.error('Error signing in anonymously:', error);
            toast.error('Failed to authenticate with Firebase');
            reject(error);
          });
      }
    });
  });
}

// Sign in anonymously to ensure database access
signInAnonymously(auth)
  .then(() => {
    isAuthenticated = true;
    console.log('Signed in anonymously to Firebase');
  })
  .catch((error) => {
    console.error('Error signing in anonymously:', error);
    toast.error('Failed to authenticate with Firebase');
  });

// Database reference paths
const sensorsRef = ref(database, 'greenhouse/sensors');
const relaysRef = ref(database, 'greenhouse/relays');
const thresholdsRef = ref(database, 'greenhouse/thresholds');
const modeRef = ref(database, 'greenhouse/mode');
const statusRef = ref(database, 'greenhouse/status');
const historyRef = ref(database, 'greenhouse/history');
const alertsRef = ref(database, 'greenhouse/alerts');
// ESP32-CAM references
const esp32CommandRef = ref(database, 'commands');
const esp32StatusRef = ref(database, 'status');
const photosRef = ref(database, 'photos'); // Direct path to photos from ESP32CAM

// Sensor data interface
export interface SensorData {
  temperature: number[];
  humidity: number[];
  moisture: number[];
  co2: number;
  lastUpdate: number;
  memory?: number;
}

// Relay status interface
export interface RelayStatus {
  pump1: boolean;
  pump2: boolean;
  fan: boolean;
  light: boolean;
}

// Threshold values interface
export interface ThresholdValues {
  moisture: number;
  temperature: number;
  co2: number;
  lightOn: string;
  lightOff: string;
}

// Mode interface
export interface ModeSettings {
  automatic: boolean;
}

// System status interface
export interface SystemStatus {
  isOnline: boolean;
  ipAddress: string;
  lastSeen: number;
  version: string;
  freeHeap?: number;
  startTime?: number;
}

// History data point interface
export interface HistoryDataPoint {
  datetimeUpdate: number | string;  // Can be timestamp in milliseconds or string
  co2: number;
  humidity0: number;
  humidity1: number;
  temperature0: number;
  temperature1: number;
  moisture0: number;
  moisture1: number;
  moisture2: number;
  moisture3: number;
  timestamp?: number;  // Optional additional timestamp field
}

// Alert settings interface
export interface AlertSettings {
  email: string;
  temperatureAlerts: boolean;
  moistureAlerts: boolean;
  co2Alerts: boolean;
}

// ESP32-CAM Status interface
export interface ESP32Status {
  flashState: string; // "ON" or "OFF"
  photoIntervalHours: string; // String of float value
  lastUpdate: number;
  ipAddress: string;
  lastPhotoTime?: number;
}

// ESP32-CAM Command Types
export type ESP32CommandType = 'takePhoto' | 'toggleFlash' | 'setInterval';

// ESP32-CAM Command interface
export interface ESP32Command {
  id: string;
  type: ESP32CommandType;
  data?: string;
  timestamp: number;
}

// Photo interface
export interface Photo {
  id: string;
  imageData: string; // Base64 encoded image data
  timestamp: number;
  caption?: string;
}

// Subscribe to sensor data updates
export function subscribeSensorData(callback: (data: SensorData) => void) {
  return onValue(sensorsRef, (snapshot) => {
    const data = snapshot.val() as SensorData | null;
    if (data) {
      callback(data);
    }
  }, (error) => {
    console.error('Error subscribing to sensor data:', error);
    toast.error('Failed to load sensor data');
  });
}

// Subscribe to relay status updates
export function subscribeRelayStatus(callback: (status: RelayStatus) => void) {
  return onValue(relaysRef, (snapshot) => {
    const status = snapshot.val() as RelayStatus | null;
    if (status) {
      callback(status);
    }
  }, (error) => {
    console.error('Error subscribing to relay status:', error);
    toast.error('Failed to load relay status');
  });
}

// Subscribe to threshold updates
export function subscribeThresholds(callback: (thresholds: ThresholdValues) => void) {
  return onValue(thresholdsRef, (snapshot) => {
    const thresholds = snapshot.val() as ThresholdValues | null;
    if (thresholds) {
      callback(thresholds);
    }
  }, (error) => {
    console.error('Error subscribing to thresholds:', error);
    toast.error('Failed to load threshold values');
  });
}

// Subscribe to mode settings
export function subscribeMode(callback: (mode: ModeSettings) => void) {
  return onValue(modeRef, (snapshot) => {
    const mode = snapshot.val() as ModeSettings | null;
    if (mode) {
      callback(mode);
    }
  }, (error) => {
    console.error('Error subscribing to mode settings:', error);
    toast.error('Failed to load mode settings');
  });
}

// Subscribe to system status
export function subscribeSystemStatus(callback: (status: SystemStatus) => void) {
  return onValue(statusRef, (snapshot) => {
    const status = snapshot.val() as SystemStatus | null;
    if (status) {
      callback(status);
    }
  }, (error) => {
    console.error('Error subscribing to system status:', error);
    toast.error('Failed to load system status');
  });
}

// Subscribe to alert settings
export function subscribeAlerts(callback: (alertSettings: AlertSettings) => void) {
  let unsubscribeFunction = () => {};
  
  // Make sure authentication is established first
  ensureAuthentication()
    .then(() => {
      // Once authenticated, set up the listener
      const unsubscribe = onValue(alertsRef, (snapshot) => {
        let settings = snapshot.val() as AlertSettings | null;
        
        // If no settings exist, initialize with defaults
        if (!settings) {
          settings = {
            email: '',
            temperatureAlerts: false,
            moistureAlerts: false,
            co2Alerts: false
          };
          // Create default settings in Firebase
          update(alertsRef, settings);
        }
        
        callback(settings);
      }, (error) => {
        console.error('Error subscribing to alert settings:', error);
        toast.error('Failed to load alert settings');
      });
      
      // Save the unsubscribe function
      unsubscribeFunction = unsubscribe;
    })
    .catch(error => {
      console.error('Authentication error when subscribing to alerts:', error);
      toast.error('Authentication failed when loading alerts');
    });
  
  // Return a function that will unsubscribe when called
  return () => {
    unsubscribeFunction();
    console.log('Unsubscribed from alerts');
  };
}

// Subscribe to ESP32-CAM status
export function subscribeESP32Status(callback: (status: ESP32Status | null) => void) {
  return onValue(esp32StatusRef, (snapshot) => {
    const status = snapshot.val() as ESP32Status | null;
    
    if (status) {
      callback(status);
    } else {
      console.log("No ESP32-CAM status in Firebase, creating default");
      // If no status exists, create a default one
      const defaultStatus: ESP32Status = {
        flashState: 'OFF',
        photoIntervalHours: '12.0',
        lastUpdate: Date.now(),
        ipAddress: 'Not connected yet'
      };
      
      // Update Firebase with default status
      set(esp32StatusRef, defaultStatus)
        .then(() => {
          console.log("Default ESP32-CAM status created");
          callback(defaultStatus);
        })
        .catch((error) => {
          console.error("Error creating default ESP32-CAM status:", error);
          callback(null);
        });
    }
  }, (error) => {
    console.error('Error subscribing to ESP32-CAM status:', error);
    toast.error('Failed to load ESP32-CAM status');
    callback(null);
  });
}

// Send a command to ESP32-CAM with the new command structure
export function sendESP32Command(type: ESP32CommandType, data?: string) {
  // Create a unique ID for the command
  const id = Date.now().toString();
  
  // Create the command object
  const command: ESP32Command = {
    id,
    type,
    timestamp: Date.now()
  };
  
  // Add data if provided
  if (data !== undefined) {
    command.data = data;
  }
  
  return set(esp32CommandRef, command)
    .then(() => {
      toast.success(`Command sent: ${type}`);
      return true;
    })
    .catch((error) => {
      console.error('Error sending command to ESP32-CAM:', error);
      toast.error('Failed to send command');
      throw error;
    });
}

// Convenience functions for specific commands

// Take a new photo
export function takePhoto() {
  return sendESP32Command('takePhoto');
}

// Toggle the flash LED
export function toggleFlash() {
  return sendESP32Command('toggleFlash');
}

// Set the automatic photo interval in hours
export function setPhotoInterval(hours: number) {
  return sendESP32Command('setInterval', hours.toString());
}

// Subscribe to ESP32-CAM photos
export function subscribePhotos(callback: (photos: Photo[]) => void) {
  console.log('Setting up photo subscription');
  try {
    // Query to get the latest 100 photos, ordered by timestamp (most recent first)
    const photosQuery = query(
      photosRef, 
      orderByChild('timestamp'), 
      limitToLast(100)
    );
    
    return onValue(photosQuery, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        console.log('No photos found in Firebase');
        callback([]);
        return;
      }
      
      // Convert the object to an array and sort by timestamp in descending order
      const photoArray: Photo[] = Object.entries(data).map(([id, photoData]: [string, any]) => ({
        id,
        imageData: photoData.imageData || '',
        timestamp: photoData.timestamp || Date.now(),
        caption: photoData.caption || ''
      }))
      .sort((a, b) => b.timestamp - a.timestamp); // Sort in descending order (newest first)
      
      console.log(`Retrieved ${photoArray.length} photos from ESP32-CAM`);
      callback(photoArray);
    }, (error) => {
      console.error('Error subscribing to photos:', error);
      toast.error('Failed to load plant photos');
      callback([]);
    });
  } catch (error) {
    console.error('Error setting up photo subscription:', error);
    return () => {}; // Return dummy unsubscribe function
  }
}

// Save a new photo directly to Firebase (for testing purposes)
export function savePhoto(imageData: string, caption?: string) {
  try {
    console.log('Saving photo to Firebase at path: photos');
    
    // Create a reference to the database path
    const newPhotoRef = push(photosRef);
    
    // Create the photo object with all necessary fields
    const photoData = {
      imageData,
      caption: caption || `Plant photo ${new Date().toLocaleString()}`,
      timestamp: serverTimestamp(),
    };
    
    // Set the data at the new reference
    return set(newPhotoRef, photoData);
  } catch (error) {
    console.error('Error saving photo:', error);
    toast.error('Failed to save photo to database');
    throw error;
  }
}

// Update alert settings
export function updateAlertSettings(settings: AlertSettings) {
  return update(alertsRef, settings)
    .then(() => {
      toast.success('Alert settings updated');
      return true;
    })
    .catch((error) => {
      console.error('Error updating alert settings:', error);
      toast.error('Failed to update alert settings');
      return false;
    });
}

// Get history data (last 100 entries)
export function getHistoryData(callback: (data: HistoryDataPoint[]) => void) {
  let unsubscribeFunction = () => {};
  
  // Make sure authentication is established first
  ensureAuthentication()
    .then(() => {
      const historyQuery = query(historyRef, orderByChild('datetimeUpdate'), limitToLast(100));
      
      // Once authenticated, set up the listener
      const unsubscribe = onValue(historyQuery, (snapshot) => {
        const historyData: HistoryDataPoint[] = [];
        snapshot.forEach((childSnapshot: DataSnapshot) => {
          historyData.push(childSnapshot.val() as HistoryDataPoint);
        });
        
        // Sort by timestamp ascending, converting string timestamps to numbers if needed
        historyData.sort((a, b) => {
          const aTime = typeof a.datetimeUpdate === 'number' ? a.datetimeUpdate : Number(a.datetimeUpdate);
          const bTime = typeof b.datetimeUpdate === 'number' ? b.datetimeUpdate : Number(b.datetimeUpdate);
          return aTime - bTime;
        });
        
        callback(historyData);
      }, (error) => {
        console.error('Error getting history data:', error);
        toast.error('Failed to load history data');
      });
      
      // Save the unsubscribe function
      unsubscribeFunction = unsubscribe;
    })
    .catch(error => {
      console.error('Authentication error when getting history data:', error);
      toast.error('Authentication failed when loading history data');
    });
  
  // Return a function that will unsubscribe when called
  return () => {
    unsubscribeFunction();
    console.log('Unsubscribed from history data');
  };
}

// Update relay settings
export function updateRelay(relay: keyof RelayStatus, value: boolean) {
  return update(relaysRef, { [relay]: value })
    .then(() => {
      toast.success(`${relay.charAt(0).toUpperCase() + relay.slice(1)} ${value ? 'activated' : 'deactivated'}`);
      return true;
    })
    .catch((error) => {
      console.error(`Error updating ${relay}:`, error);
      toast.error(`Failed to update ${relay}`);
      return false;
    });
}

// Update mode settings
export function updateMode(automatic: boolean) {
  return update(modeRef, { automatic })
    .then(() => {
      toast.success(`Switched to ${automatic ? 'automatic' : 'manual'} mode`);
      return true;
    })
    .catch((error) => {
      console.error('Error updating mode:', error);
      toast.error('Failed to update mode');
      return false;
    });
}

// Update threshold values
export function updateThreshold(threshold: keyof ThresholdValues, value: number | string) {
  return update(thresholdsRef, { [threshold]: value })
    .then(() => {
      toast.success(`${threshold.charAt(0).toUpperCase() + threshold.slice(1)} threshold updated`);
      return true;
    })
    .catch((error) => {
      console.error(`Error updating ${threshold} threshold:`, error);
      toast.error(`Failed to update ${threshold} threshold`);
      return false;
    });
}

// Delete a photo from Firebase
export function deletePhoto(photoId: string) {
  try {
    console.log('Deleting photo from Firebase with ID:', photoId);
    const photoRef = ref(database, `photos/${photoId}`);
    return remove(photoRef)
      .then(() => {
        toast.success('Photo deleted successfully');
        return true;
      })
      .catch((error) => {
        console.error('Error deleting photo:', error);
        toast.error('Failed to delete photo');
        return false;
      });
  } catch (error) {
    console.error('Error deleting photo:', error);
    toast.error('Failed to delete photo');
    return Promise.resolve(false);
  }
}

export default {
  subscribeSensorData,
  subscribeRelayStatus,
  subscribeThresholds,
  subscribeMode,
  subscribeSystemStatus,
  subscribeAlerts,
  subscribeESP32Status,
  subscribePhotos,
  sendESP32Command,
  takePhoto,
  toggleFlash,
  setPhotoInterval,
  savePhoto,
  deletePhoto,
  updateAlertSettings,
  getHistoryData,
  updateRelay,
  updateMode,
  updateThreshold
};
