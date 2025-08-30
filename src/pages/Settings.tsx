import { useEffect } from 'react';
import Header from '@/components/Header';
import ThresholdSettings from '@/components/ThresholdSettings';
import { Wifi, Database, AlertTriangle, Bell, BellOff, Mail, ChevronDown, Sun, Moon, Thermometer, Droplet, Wind } from 'lucide-react';
import { useState } from 'react';
import { SystemStatus, subscribeSystemStatus, subscribeAlerts, updateAlertSettings, AlertSettings } from '@/services/firebase';
import { formatInTimeZone } from 'date-fns-tz';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/components/ThemeProvider';

// Memory thresholds in bytes
const MEMORY_WARNING = 20000; // Warning if free memory below 20KB
const MEMORY_CRITICAL = 10000; // Critical if free memory below 10KB

const Settings = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem('alertEmail'));
  const [currentTime, setCurrentTime] = useState(new Date());
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    email: '',
    temperatureAlerts: false,
    moistureAlerts: false,
    soilTemperatureAlerts: false,
    humidityAlerts: false
  });
  useEffect(() => {
    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    const unsubscribe = subscribeSystemStatus(status => {
      setSystemStatus(status);
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
      unsubscribe();
      unsubscribeAlerts();
      clearInterval(timeInterval);
    };
  }, []);

  // Handle alert setting changes
  const updateAlertSetting = (setting: keyof AlertSettings, value: boolean | string) => {
    const newSettings = {
      ...alertSettings,
      [setting]: value
    };
    setAlertSettings(newSettings);
    updateAlertSettings(newSettings);
  };
  const getMemoryStatus = () => {
    if (!systemStatus?.freeHeap) return {
      color: 'text-gray-500',
      text: 'Unknown'
    };
    if (systemStatus.freeHeap < MEMORY_CRITICAL) {
      return {
        color: 'text-red-500',
        text: 'Critical'
      };
    } else if (systemStatus.freeHeap < MEMORY_WARNING) {
      return {
        color: 'text-amber-500',
        text: 'Warning'
      };
    } else {
      return {
        color: 'text-green-500',
        text: 'Good'
      };
    }
  };
  const memoryStatus = getMemoryStatus();

  // Format activity times properly - for last activity, use the actual lastSeen value
  const formatActivityTime = (timestamp: number | undefined) => {
    if (!timestamp) return 'Unknown';

    // Create a date object from the timestamp
    const date = new Date(timestamp);
    return formatInTimeZone(date, 'Asia/Kolkata', "PPpp") + ' IST';
  };

  return <div className="min-h-screen bg-background">
    <Header />

    <main className="container mx-auto px-4 py-6 fade-in">

      <div className="grid gap-6">
        <Collapsible className="w-full">
          <div className="modern-card overflow-hidden">
            <CollapsibleTrigger className="w-full text-left">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-2">
                  <Bell className="h-4 w-4 text-primary" />
                  <div>
                    <h3 className="font-medium text-foreground">Alert Settings</h3>
                    <p className="text-xs text-muted-foreground">Configure notification preferences</p>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 ui-expanded:rotate-180" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 border-t border-border/50">
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="alert-email" className="text-sm font-medium">Email Address</Label>
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="alert-email"
                        type="email"
                        value={alertSettings?.email || ''}
                        onChange={e => updateAlertSetting('email', e.target.value)}
                        placeholder="your@email.com"
                        className="bg-card/50 border-border/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-foreground">Alert Types</h4>

                    <div className="flex items-center justify-between p-3 bg-card/30 rounded-lg border border-border/50">
                      <div className="flex items-center space-x-2">
                        <Thermometer className="h-4 w-4 text-primary" />
                        <span className="text-sm">Temperature</span>
                        {alertSettings?.temperatureAlerts ? <Bell className="h-3 w-3 text-primary" /> : <BellOff className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <Switch
                        checked={!!alertSettings?.temperatureAlerts}
                        onCheckedChange={checked => updateAlertSetting('temperatureAlerts', checked)}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-card/30 rounded-lg border border-border/50">
                      <div className="flex items-center space-x-2">
                        <Droplet className="h-4 w-4 text-primary" />
                        <span className="text-sm">Soil Moisture</span>
                        {alertSettings?.moistureAlerts ? <Bell className="h-3 w-3 text-primary" /> : <BellOff className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <Switch
                        checked={!!alertSettings?.moistureAlerts}
                        onCheckedChange={checked => updateAlertSetting('moistureAlerts', checked)}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-card/30 rounded-lg border border-border/50">
                      <div className="flex items-center space-x-2">
                        <Thermometer className="h-4 w-4 text-primary" />
                        <span className="text-sm">Soil Temperature</span>
                        {alertSettings?.soilTemperatureAlerts ? <Bell className="h-3 w-3 text-primary" /> : <BellOff className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <Switch
                        checked={!!alertSettings?.soilTemperatureAlerts}
                        onCheckedChange={checked => updateAlertSetting('soilTemperatureAlerts', checked)}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-card/30 rounded-lg border border-border/50">
                      <div className="flex items-center space-x-2">
                        <Droplet className="h-4 w-4 text-primary" />
                        <span className="text-sm">Humidity</span>
                        {alertSettings?.humidityAlerts ? <Bell className="h-3 w-3 text-primary" /> : <BellOff className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <Switch
                        checked={!!alertSettings?.humidityAlerts}
                        onCheckedChange={checked => updateAlertSetting('humidityAlerts', checked)}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>


                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        <ThresholdSettings />

        {/* Appearance card */}
        <div className="modern-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {useTheme().theme === 'light' ? <Sun className="h-4 w-4 text-primary" /> : <Moon className="h-4 w-4 text-primary" />}
              <div>
                <h3 className="font-medium text-foreground">Appearance</h3>
                <p className="text-xs text-muted-foreground">Toggle dark mode</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <div className="modern-card p-4">
          <div className="flex items-center space-x-2 mb-4">
            <Database className="h-4 w-4 text-primary" />
            <div>
              <h3 className="font-medium text-foreground">System Information</h3>
              <p className="text-xs text-muted-foreground">Greenhouse system status</p>
            </div>
          </div>
          {!systemStatus ? <div className="space-y-3 animate-pulse">
            {[...Array(2)].map((_, i) => <div key={i} className="h-12 bg-muted rounded"></div>)}
          </div> : <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-card/30 rounded-lg border border-border/50">
              <div className="flex items-center space-x-2">
                <Wifi className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Connection</p>
                  <p className="text-xs text-muted-foreground mono">
                    {systemStatus?.ipAddress || 'No IP'}
                  </p>
                </div>
              </div>
              <div className={`status-dot ${systemStatus?.isOnline ? 'status-online' : 'status-offline'}`} />
            </div>

            {systemStatus?.freeHeap !== undefined && <div className="flex items-center justify-between p-3 bg-card/30 rounded-lg border border-border/50">
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4 text-primary" />
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">Memory</p>
                    <span className={`text-xs font-medium mono ${memoryStatus.color}`}>
                      {memoryStatus.text}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mono">
                    {(systemStatus.freeHeap / 1024).toFixed(1)}KB free
                  </p>
                </div>
              </div>
              <div className={`status-dot ${memoryStatus.text === 'Good' ? 'status-online' : memoryStatus.text === 'Warning' ? 'status-warning' : 'status-offline'}`} />
            </div>}
          </div>}
        </div>
      </div>
    </main>
  </div>;
};
export default Settings;
