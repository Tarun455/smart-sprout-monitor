import { toast } from "sonner";
import { ThresholdValues, SensorData } from './firebase';

// Email service endpoint - replace with actual API if available
const EMAIL_API_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";
const SERVICE_ID = "service_your_id"; // Replace with your EmailJS service ID
const TEMPLATE_ID = "template_your_id"; // Replace with your EmailJS template ID
const USER_ID = "user_your_id"; // Replace with your EmailJS user ID

// Track when alerts were last sent to prevent spamming
const lastAlertSent: Record<string, number> = {
  temperature: 0,
  moisture: 0,
};

// Cooldown period between alerts (10 minutes)
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;

// Alert enabled settings
interface AlertEnabledSettings {
  temperatureAlerts?: boolean;
  moistureAlerts?: boolean;
}

export const checkThresholds = (
  sensorData: SensorData, 
  thresholds: ThresholdValues, 
  userEmail?: string,
  alertEnabled: AlertEnabledSettings = {
    temperatureAlerts: true,
    moistureAlerts: true
  }
): void => {
  if (!sensorData || !thresholds) return;
  
  const now = Date.now();
  
  // Extract individual moisture values
  const moisture1 = sensorData.moisture[0] || 0;
  const moisture2 = sensorData.moisture[1] || 0;
  const moisture3 = sensorData.moisture[2] || 0;
  const moisture4 = sensorData.moisture[3] || 0;
  
  // Check greenhouse temperature if enabled (sensors 1 & 2 only)
  if (alertEnabled.temperatureAlerts !== false) {
    const greenhouseTemperatures = sensorData.temperature.slice(0, 2); // Only greenhouse sensors 1 & 2
    const avgGreenhouseTemperature = greenhouseTemperatures.reduce((sum, val) => sum + val, 0) / greenhouseTemperatures.length;
    if (avgGreenhouseTemperature > thresholds.temperature && (now - lastAlertSent.temperature) > ALERT_COOLDOWN_MS) {
      sendAlert(
        'temperature', 
        `Greenhouse temperature threshold exceeded: ${avgGreenhouseTemperature.toFixed(1)}°C (threshold: ${thresholds.temperature}°C)`,
        userEmail
      );
      lastAlertSent.temperature = now;
    }
  }
  
  // Check moisture if enabled
  if (alertEnabled.moistureAlerts !== false) {
    const highestMoisture = Math.max(moisture1, moisture2, moisture3, moisture4);
    if (highestMoisture > thresholds.moisture && (now - lastAlertSent.moisture) > ALERT_COOLDOWN_MS) {
      sendAlert(
        'moisture',
        `Soil moisture threshold exceeded: ${highestMoisture.toFixed(0)} (threshold: ${thresholds.moisture})`,
        userEmail
      );
      lastAlertSent.moisture = now;
    }
  }
  

};

const sendAlert = async (type: string, message: string, email?: string): Promise<void> => {
  // Show alert in UI regardless of email configuration
  toast.warning(`Alert: ${message}`, {
    duration: 8000,
  });
  
  // If no email is provided, don't attempt to send
  if (!email) {
    console.log('No email configured for alerts. Showing UI notification only.');
    return;
  }
  
  try {
    // Send email using EmailJS or your preferred email service
    const response = await fetch(EMAIL_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: SERVICE_ID,
        template_id: TEMPLATE_ID,
        user_id: USER_ID,
        template_params: {
          to_email: email,
          alert_type: type,
          alert_message: message,
          time: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        },
      }),
    });
    
    if (response.ok) {
      console.log(`Alert email sent for ${type}`);
    } else {
      console.error('Failed to send alert email:', await response.text());
    }
  } catch (error) {
    console.error('Error sending alert email:', error);
  }
};
