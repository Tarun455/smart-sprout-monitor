import { useState, useEffect } from 'react';
import { Thermometer, Droplet, Wind, Clock } from 'lucide-react';
import { subscribeSensorData, SensorData, subscribeThresholds, ThresholdValues } from '@/services/firebase';
import { formatInTimeZone } from 'date-fns-tz';
const SensorReadings = () => {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [thresholds, setThresholds] = useState<ThresholdValues | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    const unsubscribeSensors = subscribeSensorData(data => {
      setSensorData(data);

      // Format timestamp to human-readable date & time in IST
      if (data.lastUpdate) {
        // Convert the timestamp to a Date object
        const updateDate = new Date(data.lastUpdate);
        setLastUpdate(formatInTimeZone(updateDate, 'Asia/Kolkata', "h:mm:ss a"));
      }
    });
    const unsubscribeThresholds = subscribeThresholds(data => {
      setThresholds(data);
    });
    return () => {
      unsubscribeSensors();
      unsubscribeThresholds();
      clearInterval(timeInterval);
    };
  }, []);

  // Calculate averages
  const avgTemperature = sensorData?.temperature ? sensorData.temperature.reduce((sum, val) => sum + val, 0) / sensorData.temperature.length : 0;
  const avgHumidity = sensorData?.humidity ? sensorData.humidity.reduce((sum, val) => sum + val, 0) / sensorData.humidity.length : 0;

  // Check if values exceed thresholds
  const isTemperatureHigh = thresholds && avgTemperature > thresholds.temperature;
  const isMoistureLow = thresholds && sensorData?.moisture ? sensorData.moisture.some(m => m > 0 && m < thresholds.moisture) : false;
  const isCO2High = thresholds && sensorData?.co2 && sensorData.co2 > thresholds.co2;

  // Helper function for status indicator
  const getStatusColor = (isWarning: boolean | undefined, inverse = false) => {
    if (isWarning === undefined) return 'bg-gray-300';
    return isWarning !== inverse ? 'bg-red-500' : 'bg-green-500';
  };

  // Loading placeholder
  if (!sensorData) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-pulse">
        {[...Array(4)].map((_, index) => <div key={index} className="sensor-card bg-white/50 h-40">
            <div className="h-4 w-24 bg-gray-200 rounded mb-4"></div>
            <div className="h-8 w-16 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 w-32 bg-gray-200 rounded"></div>
          </div>)}
      </div>;
  }
  return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Temperature Card */}
      <div className="sensor-card animate-slide-in" style={{
      animationDelay: '0ms'
    }}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center">
            <Thermometer className="text-blue-500 h-5 w-5 mr-2" />
            <h3 className="font-medium text-sm text-muted-foreground">Temperature</h3>
          </div>
          
        </div>
        <div className="flex items-baseline mb-2">
          <span className="text-3xl font-semibold">{avgTemperature.toFixed(1)}</span>
          <span className="text-muted-foreground ml-1">°C</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Sensors: {sensorData.temperature.map(t => t.toFixed(1)).join(', ')} °C
          <br />
          Threshold: {thresholds?.temperature || '–'} °C
        </div>
      </div>

      {/* Humidity Card */}
      <div className="sensor-card animate-slide-in" style={{
      animationDelay: '100ms'
    }}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center">
            <Droplet className="text-blue-500 h-5 w-5 mr-2" />
            <h3 className="font-medium text-sm text-muted-foreground">Humidity</h3>
          </div>
        </div>
        <div className="flex items-baseline mb-2">
          <span className="text-3xl font-semibold">{avgHumidity.toFixed(1)}</span>
          <span className="text-muted-foreground ml-1">%</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Sensors: {sensorData.humidity.map(h => h.toFixed(1)).join(', ')} %
        </div>
      </div>

      {/* Soil Moisture Card */}
      <div className="sensor-card animate-slide-in" style={{
      animationDelay: '200ms'
    }}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center">
            <Droplet className="text-blue-500 h-5 w-5 mr-2" />
            <h3 className="font-medium text-sm text-muted-foreground">Soil Moisture</h3>
          </div>
          
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 mb-2">
          {sensorData.moisture.map((m, i) => <div key={i} className="flex flex-col">
              <span className="text-xs text-muted-foreground">Section {i + 1}</span>
              <span className="text-lg font-semibold">{m.toFixed(0)}</span>
            </div>)}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Threshold: {thresholds?.moisture || '–'} (Watering above)
        </div>
      </div>

      {/* CO2 Card */}
      <div className="sensor-card animate-slide-in" style={{
      animationDelay: '300ms'
    }}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center">
            <Wind className="text-blue-500 h-5 w-5 mr-2" />
            <h3 className="font-medium text-sm text-muted-foreground">CO₂ Level</h3>
          </div>
          
        </div>
        <div className="flex items-baseline mb-2">
          <span className="text-3xl font-semibold">{sensorData.co2.toFixed(0)}</span>
          <span className="text-muted-foreground ml-1">ppm</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Threshold: {thresholds?.co2 || '–'} ppm
          <br />
          
        </div>
      </div>
    </div>;
};
export default SensorReadings;