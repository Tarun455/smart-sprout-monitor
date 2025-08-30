import { useState, useEffect } from 'react';
import { Thermometer, Droplet, Gauge, AlertTriangle } from 'lucide-react';
import { subscribeSensorData, SensorData, subscribeThresholds, ThresholdValues } from '@/services/firebase';
import { safeToFixed, safeAverage, safeSensorValue } from '@/utils/dataValidation';

const SensorReadings = () => {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [thresholds, setThresholds] = useState<ThresholdValues | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let sensorDataReceived = false;
    let thresholdsReceived = false;

    const checkLoadingComplete = () => {
      if (sensorDataReceived && thresholdsReceived) {
        setIsLoading(false);
      }
    };

    const unsubscribeSensors = subscribeSensorData(data => {
      setSensorData(data);
      sensorDataReceived = true;
      setError(null);
      checkLoadingComplete();
    });

    const unsubscribeThresholds = subscribeThresholds(data => {
      setThresholds(data);
      thresholdsReceived = true;
      setError(null);
      checkLoadingComplete();
    });

    // Just set loading to false after initial setup - keep showing old data if connection fails
    const initialTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    return () => {
      unsubscribeSensors();
      unsubscribeThresholds();
      clearTimeout(initialTimeout);
    };
  }, []);

  // Calculate averages for greenhouse sensors (1 & 2) using safe functions
  const avgGreenhouseTemperature = safeAverage(sensorData?.temperature, 0, 2);
  const avgGreenhouseHumidity = safeAverage(sensorData?.humidity, 0, 2);
  const avgSoilTemperature = safeAverage(sensorData?.soilTemperature);

  // Outside sensor data (sensor 3) for comparison using safe access
  const outsideTemperature = safeSensorValue(sensorData?.temperature, 2);
  const outsideHumidity = safeSensorValue(sensorData?.humidity, 2);





  // Don't show error state - just keep showing old data

  // Loading placeholder
  if (isLoading || !sensorData) {
    return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 animate-pulse">
      {[...Array(4)].map((_, index) => <div key={index} className="modern-card p-3 sm:p-4 min-h-[140px] sm:min-h-[160px]">
        <div className="h-3 w-20 bg-muted rounded mb-3"></div>
        <div className="h-8 w-16 bg-muted rounded mb-2"></div>
        <div className="h-2 w-24 bg-muted rounded mb-1"></div>
        <div className="h-2 w-20 bg-muted rounded"></div>
      </div>)}
    </div>;
  }

  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
    {/* Temperature Card - Combined Greenhouse and Outside */}
    <div className="modern-card p-4 sm:p-5 fade-in relative">
      <div className="flex items-center space-x-2 mb-3">
        <Thermometer className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground mono">TEMPERATURE</span>
      </div>
      <div className="flex items-baseline space-x-1 mb-3">
        <span className="text-2xl sm:text-3xl font-bold text-foreground">{safeToFixed(avgGreenhouseTemperature)}</span>
        <span className="text-sm text-muted-foreground">°C</span>
      </div>

      {/* Mobile layout - stacked vertically */}
      <div className="sm:hidden">
        <div className="text-xs text-muted-foreground mono mb-3 leading-relaxed space-y-1">
          <div>S1: {safeToFixed(safeSensorValue(sensorData?.temperature, 0))}°C</div>
          <div>S2: {safeToFixed(safeSensorValue(sensorData?.temperature, 1))}°C</div>
        </div>
        <div className="text-xs text-foreground font-semibold mono mb-2">
          Outside: {safeToFixed(outsideTemperature)}°C
        </div>
        <div className="text-xs text-muted-foreground/70 mono">
          ↑ {thresholds?.temperature || '–'} °C
        </div>
      </div>

      {/* Desktop layout - with absolute positioning */}
      <div className="hidden sm:block">
        <div className="text-xs text-muted-foreground mono mb-8 leading-relaxed space-y-1">
          <div>S1: {safeToFixed(safeSensorValue(sensorData?.temperature, 0))}°C</div>
          <div>S2: {safeToFixed(safeSensorValue(sensorData?.temperature, 1))}°C</div>
        </div>
        <div className="absolute bottom-3 left-4 text-xs mono space-y-1">
          <div className="text-foreground font-semibold">
            Outside: {safeToFixed(outsideTemperature)}°C
          </div>
          <div className="text-muted-foreground/70">
            ↑ {thresholds?.temperature || '–'} °C
          </div>
        </div>
      </div>
    </div>

    {/* Humidity Card - Updated for consistency with Temperature and Soil Temperature */}
    <div className="modern-card p-4 sm:p-5 fade-in relative" style={{ animationDelay: '100ms' }}>
      <div className="flex items-center space-x-2 mb-3">
        <Droplet className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground mono">HUMIDITY</span>
      </div>
      <div className="flex items-baseline space-x-1 mb-3">
        <span className="text-2xl sm:text-3xl font-bold text-foreground">{safeToFixed(avgGreenhouseHumidity)}</span>
        <span className="text-sm text-muted-foreground">%</span>
      </div>

      {/* Mobile layout - stacked vertically */}
      <div className="sm:hidden">
        <div className="text-xs text-muted-foreground mono mb-3 leading-relaxed space-y-1">
          <div>S1: {safeToFixed(safeSensorValue(sensorData?.humidity, 0))}%</div>
          <div>S2: {safeToFixed(safeSensorValue(sensorData?.humidity, 1))}%</div>
        </div>
        <div className="text-xs text-foreground font-semibold mono mb-2">
          Outside: {safeToFixed(outsideHumidity)}%
        </div>
        <div className="text-xs text-muted-foreground/70 mono">
          ↑ {thresholds?.humidity || '–'} %
        </div>
      </div>

      {/* Desktop layout - with absolute positioning */}
      <div className="hidden sm:block">
        <div className="text-xs text-muted-foreground mono mb-8 leading-relaxed space-y-1">
          <div>S1: {safeToFixed(safeSensorValue(sensorData?.humidity, 0))}%</div>
          <div>S2: {safeToFixed(safeSensorValue(sensorData?.humidity, 1))}%</div>
        </div>
        <div className="absolute bottom-3 left-4 text-xs mono space-y-1">
          <div className="text-foreground font-semibold">
            Outside: {safeToFixed(outsideHumidity)}%
          </div>
          <div className="text-muted-foreground/70">
            ↑ {thresholds?.humidity || '–'} %
          </div>
        </div>
      </div>
    </div>

    {/* Soil Temperature Card - Similar format to Temperature and Humidity */}
    <div className="modern-card p-4 sm:p-5 fade-in relative" style={{ animationDelay: '200ms' }}>
      <div className="flex items-center space-x-2 mb-3">
        <Thermometer className="h-4 w-4 text-orange-500 flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground mono">SOIL TEMP</span>
      </div>
      <div className="flex items-baseline space-x-1 mb-3">
        <span className="text-2xl sm:text-3xl font-bold text-foreground">{safeToFixed(avgSoilTemperature)}</span>
        <span className="text-sm text-muted-foreground">°C</span>
      </div>

      {/* Mobile layout - stacked vertically */}
      <div className="sm:hidden">
        <div className="text-xs text-muted-foreground mono mb-3 leading-relaxed space-y-1">
          <div>S1: {safeToFixed(safeSensorValue(sensorData?.soilTemperature, 0))}°C</div>
          <div>S2: {safeToFixed(safeSensorValue(sensorData?.soilTemperature, 1))}°C</div>
        </div>
        <div className="text-xs text-muted-foreground/70 mono">
          ↑ {thresholds?.soilTemperature || '–'} °C
        </div>
      </div>

      {/* Desktop layout - with absolute positioning */}
      <div className="hidden sm:block">
        <div className="text-xs text-muted-foreground mono mb-8 leading-relaxed space-y-1">
          <div>S1: {safeToFixed(safeSensorValue(sensorData?.soilTemperature, 0))}°C</div>
          <div>S2: {safeToFixed(safeSensorValue(sensorData?.soilTemperature, 1))}°C</div>
        </div>
        <div className="absolute bottom-3 left-4 text-xs text-muted-foreground/70 mono">
          ↑ {thresholds?.soilTemperature || '–'} °C
        </div>
      </div>
    </div>

    {/* Soil Moisture Card - Moved after Soil Temperature */}
    <div className="modern-card p-4 sm:p-5 fade-in relative" style={{ animationDelay: '300ms' }}>
      <div className="flex items-center space-x-2 mb-3">
        <Gauge className="h-4 w-4 text-blue-500 flex-shrink-0" />
        <span className="text-xs font-medium text-muted-foreground mono">MOISTURE</span>
      </div>

      {/* Mobile layout - stacked vertically */}
      <div className="sm:hidden">
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(sensorData?.moisture || []).map((m, i) => (
            <div key={i} className="text-center bg-card/30 rounded-lg p-2">
              <div className="text-xs text-muted-foreground mono mb-1">S{i + 1}</div>
              <div className="text-sm font-mono font-medium text-foreground">{safeToFixed(m, 0)}</div>
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground/70 mono">
          ↑ {thresholds?.moisture || '–'} (dry)
        </div>
      </div>

      {/* Desktop layout - with absolute positioning */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-2 gap-3 mb-8">
          {(sensorData?.moisture || []).map((m, i) => (
            <div key={i} className="text-center bg-card/30 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mono mb-1">S{i + 1}</div>
              <div className="text-lg font-mono font-medium text-foreground">{safeToFixed(m, 0)}</div>
            </div>
          ))}
        </div>
        <div className="absolute bottom-3 left-4 text-xs text-muted-foreground/70 mono">
          ↑ {thresholds?.moisture || '–'} (dry)
        </div>
      </div>
    </div>
  </div>;
};
export default SensorReadings;