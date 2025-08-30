
import { useState, useEffect } from 'react';
import { Droplet, Fan, Sun, Power, AlertTriangle, Zap } from 'lucide-react';
import { subscribeRelayStatus, RelayStatus, updateRelay, subscribeMode, ModeSettings, updateMode } from '@/services/firebase';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
    return <div className="modern-card p-3 sm:p-4 animate-pulse">
      <div className="h-4 w-32 bg-muted rounded mb-4"></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-16 sm:h-20 bg-muted rounded"></div>)}
      </div>
    </div>;
  }

  const isAutomatic = modeSettings.automatic;

  return <div className="modern-card p-3 sm:p-4 fade-in">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4">
      <div className="flex items-center space-x-2">
        <Power className="h-4 w-4 text-primary flex-shrink-0" />
        <h3 className="font-medium text-foreground">Control Panel</h3>
      </div>
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-muted-foreground mono">
            {isAutomatic ? 'AUTO' : 'MANUAL'}
          </span>
          <Switch
            checked={isAutomatic}
            onCheckedChange={handleModeToggle}
            disabled={isLoading.mode}
            className="data-[state=checked]:bg-primary"
          />
        </div>
        <div className={`status-dot ${isAutomatic ? 'status-online' : 'status-warning'}`} />
      </div>
    </div>

    {isAutomatic && <div className="bg-primary/5 border border-primary/20 rounded-md p-3 mb-4 flex items-center">
      <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />
      <span className="text-xs text-muted-foreground">System is in automatic mode. Manual controls are disabled.</span>
    </div>}

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Pump 1 */}
      <div
        className={`control-button p-3 rounded-lg border cursor-pointer transition-all ${relayStatus.pump1
          ? 'bg-primary/10 border-primary/30 text-primary'
          : 'bg-card/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
          } ${isAutomatic || isLoading.pump1 ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !isAutomatic && !isLoading.pump1 && handleRelayToggle('pump1')}
      >
        <div className="flex flex-col items-center space-y-2">
          <Droplet className="h-5 w-5" />
          <div className="text-center">
            <div className="text-xs font-medium mono">PUMP 1</div>
            <div className={`text-xs mono ${relayStatus.pump1 ? 'text-primary' : 'text-muted-foreground'}`}>
              {relayStatus.pump1 ? 'ON' : 'OFF'}
            </div>
            {lastChanged.pump1 && (
              <div className="text-[10px] text-muted-foreground mt-1 mono">
                {lastChanged.pump1}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pump 2 */}
      <div
        className={`control-button p-3 rounded-lg border cursor-pointer transition-all ${relayStatus.pump2
          ? 'bg-primary/10 border-primary/30 text-primary'
          : 'bg-card/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
          } ${isAutomatic || isLoading.pump2 ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !isAutomatic && !isLoading.pump2 && handleRelayToggle('pump2')}
      >
        <div className="flex flex-col items-center space-y-2">
          <Droplet className="h-5 w-5" />
          <div className="text-center">
            <div className="text-xs font-medium mono">PUMP 2</div>
            <div className={`text-xs mono ${relayStatus.pump2 ? 'text-primary' : 'text-muted-foreground'}`}>
              {relayStatus.pump2 ? 'ON' : 'OFF'}
            </div>
            {lastChanged.pump2 && (
              <div className="text-[10px] text-muted-foreground mt-1 mono">
                {lastChanged.pump2}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fan */}
      <div
        className={`control-button p-3 rounded-lg border cursor-pointer transition-all ${relayStatus.fan
          ? 'bg-primary/10 border-primary/30 text-primary'
          : 'bg-card/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
          } ${isAutomatic || isLoading.fan ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !isAutomatic && !isLoading.fan && handleRelayToggle('fan')}
      >
        <div className="flex flex-col items-center space-y-2">
          <Fan className="h-5 w-5" />
          <div className="text-center">
            <div className="text-xs font-medium mono">FAN</div>
            <div className={`text-xs mono ${relayStatus.fan ? 'text-primary' : 'text-muted-foreground'}`}>
              {relayStatus.fan ? 'ON' : 'OFF'}
            </div>
            {lastChanged.fan && (
              <div className="text-[10px] text-muted-foreground mt-1 mono">
                {lastChanged.fan}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Light */}
      <div
        className={`control-button p-3 rounded-lg border cursor-pointer transition-all ${relayStatus.light
          ? 'bg-primary/10 border-primary/30 text-primary'
          : 'bg-card/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
          } ${isAutomatic || isLoading.light ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !isAutomatic && !isLoading.light && handleRelayToggle('light')}
      >
        <div className="flex flex-col items-center space-y-2">
          <Sun className="h-5 w-5" />
          <div className="text-center">
            <div className="text-xs font-medium mono">LIGHTS</div>
            <div className={`text-xs mono ${relayStatus.light ? 'text-primary' : 'text-muted-foreground'}`}>
              {relayStatus.light ? 'ON' : 'OFF'}
            </div>
            {lastChanged.light && (
              <div className="text-[10px] text-muted-foreground mt-1 mono">
                {lastChanged.light}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>;
};
export default ControlPanel;
