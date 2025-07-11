
import { useState, useEffect } from 'react';
import { Droplet, Fan, SunMedium, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { subscribeRelayStatus, RelayStatus, updateRelay, subscribeMode, ModeSettings, updateMode } from '@/services/firebase';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const ControlPanel = () => {
  const [relayStatus, setRelayStatus] = useState<RelayStatus | null>(null);
  const [modeSettings, setModeSettings] = useState<ModeSettings | null>(null);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [lastChanged, setLastChanged] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribeRelays = subscribeRelayStatus(status => {
      // Compare previous status to detect changes
      if (relayStatus) {
        Object.keys(status).forEach(key => {
          const relay = key as keyof RelayStatus;
          if (status[relay] !== relayStatus[relay]) {
            // Update last changed timestamp for this relay
            setLastChanged(prev => ({
              ...prev,
              [relay]: formatInTimeZone(new Date(), 'Asia/Kolkata', "h:mm:ss a")
            }));
          }
        });
      }
      
      setRelayStatus(status);
    });
    
    const unsubscribeMode = subscribeMode(mode => {
      setModeSettings(mode);
    });
    
    return () => {
      unsubscribeRelays();
      unsubscribeMode();
    };
  }, [relayStatus]);

  const handleRelayToggle = async (relay: keyof RelayStatus) => {
    if (!relayStatus || !modeSettings) return;

    // Check if in automatic mode
    if (modeSettings.automatic) {
      toast.error("Cannot control relays in automatic mode");
      return;
    }
    
    setIsLoading(prev => ({
      ...prev,
      [relay]: true
    }));
    
    try {
      const newStatus = !relayStatus[relay];
      await updateRelay(relay, newStatus);
      
      // Update last changed timestamp
      setLastChanged(prev => ({
        ...prev,
        [relay]: formatInTimeZone(new Date(), 'Asia/Kolkata', "h:mm:ss a")
      }));
    } catch (error) {
      console.error(`Error toggling ${relay}:`, error);
    } finally {
      setIsLoading(prev => ({
        ...prev,
        [relay]: false
      }));
    }
  };

  const handleModeToggle = async () => {
    if (!modeSettings) return;
    setIsLoading(prev => ({
      ...prev,
      mode: true
    }));
    try {
      await updateMode(!modeSettings.automatic);
    } catch (error) {
      console.error('Error toggling mode:', error);
    } finally {
      setIsLoading(prev => ({
        ...prev,
        mode: false
      }));
    }
  };

  if (!relayStatus || !modeSettings) {
    return <div className="sensor-card glass animate-pulse h-32">
        <div className="h-4 w-32 bg-gray-200 rounded mb-6"></div>
        <div className="flex justify-between">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 w-16 bg-gray-200 rounded"></div>)}
        </div>
      </div>;
  }

  const isAutomatic = modeSettings.automatic;
  
  return <div className="sensor-card glass animate-scale-in">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Control Panel</h3>
        <div className="flex items-center">
          <span className="text-sm mr-2">Mode:</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Switch checked={isAutomatic} onCheckedChange={handleModeToggle} disabled={isLoading.mode} className="font-normal text-sky-600 bg-slate-500 hover:bg-slate-400" />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{isAutomatic ? 'Automatic Mode' : 'Manual Mode'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="ml-2 text-sm font-medium">
            {isAutomatic ? <span className="text-blue-500 flex items-center">
                <ToggleRight className="h-4 w-4 mr-1" /> Auto
              </span> : <span className="text-amber-500 flex items-center">
                <ToggleLeft className="h-4 w-4 mr-1" /> Manual
              </span>}
          </span>
        </div>
      </div>

      {isAutomatic && <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4 flex items-center text-amber-800">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          <span className="text-xs">Controls are disabled in automatic mode. System is automatically controlling devices based on sensor readings.</span>
        </div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Pump 1 */}
        <Button variant="outline" size="lg" className={`control-button flex flex-col items-center justify-center py-4 ${relayStatus.pump1 ? 'bg-blue-50 border-blue-200 text-blue-500' : ''}`} onClick={() => handleRelayToggle('pump1')} disabled={isAutomatic || isLoading.pump1}>
          <Droplet className={`h-6 w-6 mb-1 ${relayStatus.pump1 ? 'text-blue-500' : ''}`} />
          <span className="text-xs font-medium">Pump 1</span>
          <span className="text-xs mt-1">
            {relayStatus.pump1 ? 'ON' : 'OFF'}
          </span>
          {lastChanged.pump1 && (
            <span className="text-[10px] text-muted-foreground mt-1">
              Changed: {lastChanged.pump1}
            </span>
          )}
        </Button>

        {/* Pump 2 */}
        <Button variant="outline" size="lg" className={`control-button flex flex-col items-center justify-center py-4 ${relayStatus.pump2 ? 'bg-blue-50 border-blue-200 text-blue-500' : ''}`} onClick={() => handleRelayToggle('pump2')} disabled={isAutomatic || isLoading.pump2}>
          <Droplet className={`h-6 w-6 mb-1 ${relayStatus.pump2 ? 'text-blue-500' : ''}`} />
          <span className="text-xs font-medium">Pump 2</span>
          <span className="text-xs mt-1">
            {relayStatus.pump2 ? 'ON' : 'OFF'}
          </span>
          {lastChanged.pump2 && (
            <span className="text-[10px] text-muted-foreground mt-1">
              Changed: {lastChanged.pump2}
            </span>
          )}
        </Button>

        {/* Fan */}
        <Button variant="outline" size="lg" className={`control-button flex flex-col items-center justify-center py-4 ${relayStatus.fan ? 'bg-blue-50 border-blue-200 text-blue-500' : ''}`} onClick={() => handleRelayToggle('fan')} disabled={isAutomatic || isLoading.fan}>
          <Fan className={`h-6 w-6 mb-1 ${relayStatus.fan ? 'text-blue-500' : ''}`} />
          <span className="text-xs font-medium">Fan</span>
          <span className="text-xs mt-1">
            {relayStatus.fan ? 'ON' : 'OFF'}
          </span>
          {lastChanged.fan && (
            <span className="text-[10px] text-muted-foreground mt-1">
              Changed: {lastChanged.fan}
            </span>
          )}
        </Button>

        {/* Light */}
        <Button variant="outline" size="lg" className={`control-button flex flex-col items-center justify-center py-4 ${relayStatus.light ? 'bg-blue-50 border-blue-200 text-blue-500' : ''}`} onClick={() => handleRelayToggle('light')} disabled={isAutomatic || isLoading.light}>
          <SunMedium className={`h-6 w-6 mb-1 ${relayStatus.light ? 'text-blue-500' : ''}`} />
          <span className="text-xs font-medium">Lights</span>
          <span className="text-xs mt-1">
            {relayStatus.light ? 'ON' : 'OFF'}
          </span>
          {lastChanged.light && (
            <span className="text-[10px] text-muted-foreground mt-1">
              Changed: {lastChanged.light}
            </span>
          )}
        </Button>
      </div>
    </div>;
};
export default ControlPanel;
