
import { useState, useEffect } from 'react';
import SensorReadings from './SensorReadings';
import ControlPanel from './ControlPanel';
import HistoryChart from './HistoryChart';
import {
  SensorData,
  subscribeSensorData,
  subscribeThresholds,
  ThresholdValues,
  subscribeAlerts,
  AlertSettings
} from '@/services/firebase';
import { checkThresholds } from '@/services/notificationService';
import { formatInTimeZone } from 'date-fns-tz';

const Dashboard = () => {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [thresholds, setThresholds] = useState<ThresholdValues | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem('alertEmail'));
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastDataUpdate, setLastDataUpdate] = useState<number>(0);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    email: '',
    temperatureAlerts: false,
    moistureAlerts: false
  });

  useEffect(() => {
    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const unsubscribeSensors = subscribeSensorData(data => {
      console.log('Received sensor data:', data);
      setSensorData(data);

      // Track the last data update timestamp
      if (data && data.lastUpdate) {
        setLastDataUpdate(data.lastUpdate);
        console.log('Updated lastDataUpdate to:', data.lastUpdate);
      }
    });

    const unsubscribeThresholds = subscribeThresholds(data => {
      setThresholds(data);
    });

    const unsubscribeAlerts = subscribeAlerts(settings => {
      setAlertSettings(settings);
      // Update localStorage email if it exists in Firebase
      if (settings.email) {
        localStorage.setItem('alertEmail', settings.email);
        setUserEmail(settings.email);
      }
    });

    return () => {
      unsubscribeSensors();
      unsubscribeThresholds();
      unsubscribeAlerts();
      clearInterval(timeInterval);
    };
  }, []);

  // Check thresholds when sensor data or thresholds change
  useEffect(() => {
    if (sensorData && thresholds && alertSettings) {
      // Only check thresholds for enabled alerts
      checkThresholds(
        sensorData,
        thresholds,
        alertSettings.email,
        {
          temperatureAlerts: alertSettings.temperatureAlerts,
          moistureAlerts: alertSettings.moistureAlerts
        }
      );
    }
  }, [sensorData, thresholds, alertSettings]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <SensorReadings />
      <ControlPanel />

      <div className="modern-card p-3 sm:p-4">
        <HistoryChart />
      </div>
    </div>
  );
};

export default Dashboard;
