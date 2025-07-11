
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Thermometer, Droplet, Wind, SunMedium, Moon } from 'lucide-react';
import {
  subscribeThresholds,
  ThresholdValues,
  updateThreshold
} from '@/services/firebase';
import { toast } from "sonner";

const ThresholdSettings = () => {
  const [thresholds, setThresholds] = useState<ThresholdValues | null>(null);
  const [tempValue, setTempValue] = useState<number>(28);
  const [moistureValue, setMoistureValue] = useState<number>(1500);
  const [co2Value, setCo2Value] = useState<number>(800);
  const [lightOnTime, setLightOnTime] = useState<string>("07:00");
  const [lightOffTime, setLightOffTime] = useState<string>("21:00");
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsubscribe = subscribeThresholds((data) => {
      setThresholds(data);
      
      // Update local state with Firebase values
      setTempValue(data.temperature);
      setMoistureValue(data.moisture);
      setCo2Value(data.co2);
      
      // Parse time strings (format: "07:00:00" or "2023-12-01T07:00:00.000Z")
      const parseTimeString = (timeStr: string) => {
        // ISO format has a T in the middle
        const tPosition = timeStr.indexOf('T');
        if (tPosition > 0) {
          // Extract time part from ISO format
          const timePart = timeStr.substring(tPosition + 1, tPosition + 6);
          return timePart;
        }
        // Already in HH:MM:SS format, just take first 5 chars
        return timeStr.substring(0, 5);
      };
      
      setLightOnTime(parseTimeString(data.lightOn));
      setLightOffTime(parseTimeString(data.lightOff));
    });
    
    return () => unsubscribe();
  }, []);

  const handleUpdateThreshold = async (threshold: keyof ThresholdValues, value: number | string) => {
    setIsLoading(prev => ({ ...prev, [threshold]: true }));
    
    try {
      // For temperature and CO2, ensure we're sending a number, not a string
      let finalValue = value;
      if (threshold === 'temperature' || threshold === 'co2' || threshold === 'moisture') {
        finalValue = Number(value);
      }
      
      await updateThreshold(threshold, finalValue);
      // Force-update the local state to match what we just sent
      if (threshold === 'temperature') setTempValue(Number(value));
      if (threshold === 'co2') setCo2Value(Number(value));
      if (threshold === 'moisture') setMoistureValue(Number(value));
      
      toast.success(`${threshold.charAt(0).toUpperCase() + threshold.slice(1)} threshold updated`);
    } catch (error) {
      console.error(`Error updating ${threshold} threshold:`, error);
      toast.error(`Failed to update ${threshold} threshold`);
    } finally {
      setIsLoading(prev => ({ ...prev, [threshold]: false }));
    }
  };

  if (!thresholds) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <CardTitle className="h-6 w-48 bg-gray-200 rounded"></CardTitle>
          <CardDescription className="h-4 w-64 bg-gray-200 rounded mt-2"></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-scale-in">
      <CardHeader>
        <CardTitle>Threshold Settings</CardTitle>
        <CardDescription>
          Configure thresholds for automatic control
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Temperature Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center">
                <Thermometer className="h-4 w-4 mr-2 text-blue-500" />
                Temperature Threshold
              </Label>
              <span className="text-sm font-medium">{tempValue}°C</span>
            </div>
            <div className="flex items-center space-x-3">
              <Slider 
                value={[tempValue]} 
                min={15} 
                max={40} 
                step={0.5}
                onValueChange={(value) => setTempValue(value[0])}
                className="flex-1"
              />
              <Button
                size="sm"
                disabled={isLoading.temperature || tempValue === thresholds.temperature}
                onClick={() => handleUpdateThreshold('temperature', tempValue)}
              >
                Set
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Fan activates when temperature exceeds threshold
            </p>
          </div>

          {/* Moisture Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center">
                <Droplet className="h-4 w-4 mr-2 text-blue-500" />
                Moisture Threshold
              </Label>
              <span className="text-sm font-medium">{moistureValue}</span>
            </div>
            <div className="flex items-center space-x-3">
              <Slider 
                value={[moistureValue]} 
                min={0} 
                max={4095} 
                step={50}
                onValueChange={(value) => setMoistureValue(value[0])}
                className="flex-1"
              />
              <Button
                size="sm"
                disabled={isLoading.moisture || moistureValue === thresholds.moisture}
                onClick={() => handleUpdateThreshold('moisture', moistureValue)}
              >
                Set
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Water pumps activate when moisture exceeds threshold (higher value = drier soil)
            </p>
          </div>

          {/* CO2 Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center">
                <Wind className="h-4 w-4 mr-2 text-blue-500" />
                CO₂ Threshold
              </Label>
              <span className="text-sm font-medium">{co2Value} ppm</span>
            </div>
            <div className="flex items-center space-x-3">
              <Slider 
                value={[co2Value]} 
                min={400} 
                max={2000} 
                step={50}
                onValueChange={(value) => setCo2Value(value[0])}
                className="flex-1"
              />
              <Button
                size="sm"
                disabled={isLoading.co2 || co2Value === thresholds.co2}
                onClick={() => handleUpdateThreshold('co2', co2Value)}
              >
                Set
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Fan activates when CO₂ level exceeds threshold
            </p>
          </div>

          {/* Light Schedule */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center">
                <SunMedium className="h-4 w-4 mr-2 text-amber-500" />
                Lights ON Time
              </Label>
              <div className="flex items-center space-x-3">
                <Input 
                  type="time" 
                  value={lightOnTime}
                  onChange={(e) => setLightOnTime(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  disabled={isLoading.lightOn || lightOnTime === thresholds.lightOn.substring(0, 5)}
                  onClick={() => handleUpdateThreshold('lightOn', `${lightOnTime}:00`)}
                >
                  Set
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center">
                <Moon className="h-4 w-4 mr-2 text-blue-800" />
                Lights OFF Time
              </Label>
              <div className="flex items-center space-x-3">
                <Input 
                  type="time" 
                  value={lightOffTime}
                  onChange={(e) => setLightOffTime(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  disabled={isLoading.lightOff || lightOffTime === thresholds.lightOff.substring(0, 5)}
                  onClick={() => handleUpdateThreshold('lightOff', `${lightOffTime}:00`)}
                >
                  Set
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ThresholdSettings;
