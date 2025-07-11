import { useEffect } from 'react';
import Header from '@/components/Header';
import ThresholdSettings from '@/components/ThresholdSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, Database, AlertTriangle, Bell, BellOff, Mail, ChevronDown, Sun, Moon } from 'lucide-react';
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
    co2Alerts: false
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
      
      <main className="container mx-auto px-4 pb-16 animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Settings</h1>
          
          <div>
            {userEmail ? <div className="text-xs text-muted-foreground flex items-center">
                
                
              </div> : <button className="text-xs text-blue-500 hover:underline" onClick={() => {
            const email = prompt('Enter email for alerts:');
            if (email) {
              localStorage.setItem('alertEmail', email);
              setUserEmail(email);
              // Also update in alertSettings
              updateAlertSetting('email', email);
            }
          }}>
                Enable email alerts
              </button>}
          </div>
        </div>
        
        <div className="grid gap-6">
          <Collapsible className="w-full">
            <Card className="overflow-hidden">
              <CollapsibleTrigger className="w-full text-left">
                <CardHeader className="flex flex-row items-center justify-between py-4">
                  <div>
                    <CardTitle className="flex items-center text-lg">
                      <Bell className="mr-2 h-4 w-4" />
                      Alert Settings
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Configure which conditions will trigger alerts
                    </CardDescription>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 ui-expanded:rotate-180" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="alert-email" className="mb-1 block text-sm">Email for alerts</Label>
                      <div className="flex items-center">
                        <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                        <Input id="alert-email" type="email" value={alertSettings?.email || ''} onChange={e => updateAlertSetting('email', e.target.value)} placeholder="Enter email address" className="w-full text-sm" />
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <div className="space-y-2 py-1">
                        <div className="flex items-center justify-between p-2 border rounded-md">
                          <Label htmlFor="temperature-alerts" className="flex items-center text-xs">
                            <span className="mr-2">Temperature</span>
                            {alertSettings?.temperatureAlerts ? <Bell className="h-3 w-3 text-green-500" /> : <BellOff className="h-3 w-3 text-gray-400" />}
                          </Label>
                          <Switch id="temperature-alerts" checked={!!alertSettings?.temperatureAlerts} onCheckedChange={checked => updateAlertSetting('temperatureAlerts', checked)} />
                        </div>
                        
                        <div className="flex items-center justify-between p-2 border rounded-md">
                          <Label htmlFor="moisture-alerts" className="flex items-center text-xs">
                            <span className="mr-2">Soil Moisture</span>
                            {alertSettings?.moistureAlerts ? <Bell className="h-3 w-3 text-green-500" /> : <BellOff className="h-3 w-3 text-gray-400" />}
                          </Label>
                          <Switch id="moisture-alerts" checked={!!alertSettings?.moistureAlerts} onCheckedChange={checked => updateAlertSetting('moistureAlerts', checked)} />
                        </div>
                        
                        <div className="flex items-center justify-between p-2 border rounded-md">
                          <Label htmlFor="co2-alerts" className="flex items-center text-xs">
                            <span className="mr-2">CO₂ Level</span>
                            {alertSettings?.co2Alerts ? <Bell className="h-3 w-3 text-green-500" /> : <BellOff className="h-3 w-3 text-gray-400" />}
                          </Label>
                          <Switch id="co2-alerts" checked={!!alertSettings?.co2Alerts} onCheckedChange={checked => updateAlertSetting('co2Alerts', checked)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <ThresholdSettings />
          
          {/* Appearance card - moved to bottom, just above System Info */}
          <Card className="overflow-hidden">
            <CardHeader className="py-4">
              <CardTitle className="text-lg flex items-center">
                {useTheme().theme === 'light' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4 flex items-center justify-between">
              <span className="text-sm">Dark mode</span>
              <ThemeToggle />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>
                Information about your greenhouse system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!systemStatus ? <div className="space-y-4 animate-pulse">
                  {[...Array(2)].map((_, i) => <div key={i} className="h-6 bg-gray-100 rounded"></div>)}
                </div> : <div className="space-y-4">
                  <div className="flex items-center space-x-3 py-2 border-b">
                    <Wifi className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Connection Status</p>
                      <p className="text-sm text-muted-foreground">
                        {systemStatus?.isOnline ? 'Online' : 'Offline'}
                        {systemStatus?.ipAddress && ` (${systemStatus.ipAddress})`}
                      </p>
                    </div>
                  </div>
                  
                  {systemStatus?.freeHeap !== undefined && <div className="flex items-center space-x-3 py-2">
                      <Database className={`h-5 w-5 ${memoryStatus.color}`} />
                      <div>
                        <div className="flex items-center">
                          <p className="text-sm font-medium">Memory Status</p>
                          <span className={`ml-2 text-xs ${memoryStatus.color} font-medium`}>
                            {memoryStatus.text}
                          </span>
                          {memoryStatus.text !== 'Good' && <AlertTriangle className={`h-3 w-3 ml-1 ${memoryStatus.color}`} />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Free memory: {systemStatus.freeHeap.toLocaleString()} bytes 
                          {memoryStatus.text !== 'Good' && <span className="text-xs ml-1">
                              ({memoryStatus.text === 'Critical' ? 'System may crash soon' : 'Memory running low'})
                            </span>}
                        </p>
                      </div>
                    </div>}
                </div>}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>;
};
export default Settings;
