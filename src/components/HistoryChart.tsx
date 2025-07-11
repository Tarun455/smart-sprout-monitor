
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getHistoryData, HistoryDataPoint } from '@/services/firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, TooltipProps } from 'recharts';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatInTimeZone } from 'date-fns-tz';

// Extended history data interface for processed data
interface ProcessedHistoryPoint extends HistoryDataPoint {
  formattedTime: string;
}

// Time range options
type TimeRange = 'hour' | 'day' | 'week' | 'month';

const HistoryChart = () => {
  const [historyData, setHistoryData] = useState<ProcessedHistoryPoint[]>([]);
  const [filteredData, setFilteredData] = useState<ProcessedHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('day');
  const isMobile = useIsMobile();
  
  // Function to fetch and process history data
  const fetchHistoryData = () => {
    console.log("Fetching history data...");
    return getHistoryData(data => {
      try {
        // Process the data for the chart
        const processedData = data.map(point => {
          // Parse the datetimeUpdate if it's a string
          let timestamp: number;
          if (typeof point.datetimeUpdate === 'string') {
            // Try to parse the string to a timestamp
            // First attempt: direct parse if it's a numeric string
            if (!isNaN(Number(point.datetimeUpdate))) {
              timestamp = Number(point.datetimeUpdate);
            } 
            // Second attempt: try to parse as date string
            else {
              const date = new Date(point.datetimeUpdate);
              timestamp = date.getTime();
            }
          } else {
            // It's already a number
            timestamp = point.datetimeUpdate;
          }
          
          console.log(`Timestamp: ${timestamp}, Original value: ${point.datetimeUpdate}, Type: ${typeof point.datetimeUpdate}`);
          
          return {
            ...point,
            datetimeUpdate: timestamp, // Ensure datetimeUpdate is a number
            formattedTime: ''  // Will be set in filterDataByTimeRange
          };
        });
        
        console.log("Processed history data:", processedData);
        setHistoryData(processedData);
        
        // Initially filter based on default time range
        filterDataByTimeRange(processedData, timeRange);
      } catch (error) {
        console.error("Error processing history data:", error);
      } finally {
        setLoading(false);
      }
    });
  };
  
  useEffect(() => {
    // Initial data fetch
    const unsubscribe = fetchHistoryData();
    
    // Set up a refresh interval to update data every 30 seconds
    const refreshInterval = setInterval(() => {
      console.log("Refreshing history data...");
      fetchHistoryData();
    }, 30000); // 30 seconds
    
    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  // Filter data based on selected time range
  const filterDataByTimeRange = (data: ProcessedHistoryPoint[], range: TimeRange) => {
    const now = Date.now();
    let cutoffTime: number;
    
    switch (range) {
      case 'hour':
        cutoffTime = now - (60 * 60 * 1000); // 1 hour ago
        break;
      case 'day':
        cutoffTime = now - (24 * 60 * 60 * 1000); // 24 hours ago
        break;
      case 'week':
        cutoffTime = now - (7 * 24 * 60 * 60 * 1000); // 7 days ago
        break;
      case 'month':
        cutoffTime = now - (30 * 24 * 60 * 60 * 1000); // 30 days ago
        break;
      default:
        cutoffTime = now - (24 * 60 * 60 * 1000); // Default to 24 hours
    }
    
    // Filter data points that are newer than the cutoff time
    const filtered = data.filter(point => {
      // Ensure datetimeUpdate is a number
      const timestamp = typeof point.datetimeUpdate === 'number' 
        ? point.datetimeUpdate 
        : Number(point.datetimeUpdate);
      
      return timestamp > cutoffTime;
    });
    
    // Sort data points by timestamp to ensure chronological order
    filtered.sort((a, b) => {
      const aTime = typeof a.datetimeUpdate === 'number' ? a.datetimeUpdate : Number(a.datetimeUpdate);
      const bTime = typeof b.datetimeUpdate === 'number' ? b.datetimeUpdate : Number(b.datetimeUpdate);
      return aTime - bTime;
    });
    
    // Format the time display based on the selected range
    const formattedData = filtered.map(point => {
      // Choose format based on time range
      let dateFormat = 'HH:mm'; // Default for hour view
      
      if (range === 'week') {
        dateFormat = 'dd MMM HH:mm';
      } else if (range === 'month') {
        dateFormat = 'dd MMM';
      } else if (range === 'day') {
        dateFormat = 'HH:mm';
      }
      
      // Ensure timestamp is a number
      const timestamp = typeof point.datetimeUpdate === 'number' 
        ? point.datetimeUpdate 
        : Number(point.datetimeUpdate);
      
      // Format time in IST timezone
      const formattedTime = formatInTimeZone(
        new Date(timestamp),
        'Asia/Kolkata',
        dateFormat
      );
      
      return {
        ...point,
        formattedTime
      };
    });
    
    setFilteredData(formattedData);
  };

  // Handle time range change
  useEffect(() => {
    if (historyData.length > 0) {
      filterDataByTimeRange(historyData, timeRange);
    }
  }, [timeRange, historyData]);

  // Custom tooltip formatter 
  const customTooltipFormatter = (value: any, name: string, props: any) => {
    // Format the display name
    let displayName = name;
    let unit = '';
    
    if (name === 'temperature0') { displayName = 'Temperature 1'; unit = '°C'; }
    if (name === 'temperature1') { displayName = 'Temperature 2'; unit = '°C'; }
    if (name === 'humidity0') { displayName = 'Humidity 1'; unit = '%'; }
    if (name === 'humidity1') { displayName = 'Humidity 2'; unit = '%'; }
    if (name === 'co2') { displayName = 'CO₂'; unit = ' ppm'; }
    if (name === 'moisture0') { displayName = 'Moisture 1'; }
    if (name === 'moisture1') { displayName = 'Moisture 2'; }
    if (name === 'moisture2') { displayName = 'Moisture 3'; }
    if (name === 'moisture3') { displayName = 'Moisture 4'; }
    
    return [`${value}${unit}`, displayName];
  };
  
  // Custom tooltip component to show the full date and time in IST
  const CustomTooltip = ({ active, payload, label }: TooltipProps<any, any>) => {
    if (active && payload && payload.length) {
      // Get timestamp from the data point
      const dataPoint = payload[0].payload;
      
      // Ensure timestamp is a number
      const timestamp = typeof dataPoint.datetimeUpdate === 'number' 
        ? dataPoint.datetimeUpdate 
        : Number(dataPoint.datetimeUpdate);
      
      // Format the timestamp as IST date and time
      const fullTimestamp = formatInTimeZone(
        new Date(timestamp),
        'Asia/Kolkata',
        'dd MMM yyyy, HH:mm:ss'
      );
      
      return (
        <div className="custom-tooltip bg-white p-3 shadow-md rounded-md border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">{fullTimestamp}</p>
          <div className="sensor-values">
            {payload.map((entry: any, index: number) => {
              // Determine unit based on data type
              let unit = '';
              if (entry.name.startsWith('temperature')) unit = '°C';
              if (entry.name.startsWith('humidity')) unit = '%';
              if (entry.name === 'co2') unit = ' ppm';
              
              return (
                <p key={`item-${index}`} style={{ color: entry.color }} className="text-xs">
                  <span className="font-medium">{entry.name}: </span>
                  <span>{entry.value.toFixed(1)}{unit}</span>
                </p>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <Card className="animate-pulse">
        <CardHeader>
          <CardTitle className="h-6 w-48 bg-gray-200 rounded"></CardTitle>
          <CardDescription className="h-4 w-64 bg-gray-200 rounded mt-2"></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-100 rounded"></div>
        </CardContent>
      </Card>;
  }

  if (historyData.length === 0) {
    return <Card>
        <CardHeader>
          <CardTitle>Sensor History</CardTitle>
          <CardDescription>No historical data available yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Waiting for data collection...
          </div>
        </CardContent>
      </Card>;
  }

  return <Card className="animate-scale-in">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <CardTitle>Sensor History</CardTitle>
            <CardDescription>
              Historical data over time
            </CardDescription>
          </div>
          <div className="w-full sm:w-auto">
            <Select
              value={timeRange}
              onValueChange={(value) => setTimeRange(value as TimeRange)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Last Hour</SelectItem>
                <SelectItem value="day">Last 24 Hours</SelectItem>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        <Tabs defaultValue="temperature" className="w-full">
          <TabsList className="mb-4 w-full overflow-x-auto flex-nowrap justify-start sm:justify-center">
            <TabsTrigger value="temperature">Temperature</TabsTrigger>
            <TabsTrigger value="humidity">Humidity</TabsTrigger>
            <TabsTrigger value="moisture">Soil Moisture</TabsTrigger>
            <TabsTrigger value="co2">CO₂ Levels</TabsTrigger>
          </TabsList>
          
          <TabsContent value="temperature" className="mt-0">
            <div className="h-64 sm:h-72 chart-container px-2 sm:px-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={filteredData} 
                  margin={{
                    top: 5,
                    right: isMobile ? 10 : 30,
                    left: isMobile ? -20 : 0,
                    bottom: 5
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="formattedTime" 
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    interval={isMobile ? 'preserveEnd' : 'preserveStartEnd'} 
                    minTickGap={10}
                  />
                  <YAxis 
                    unit="°C" 
                    domain={['dataMin - 1', 'dataMax + 1']} 
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    width={isMobile ? 35 : 40}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    formatter={customTooltipFormatter}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }}
                    iconSize={isMobile ? 8 : 10}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="temperature0" 
                    name="Temperature 1" 
                    stroke="#f97316" 
                    strokeWidth={2} 
                    dot={false} 
                    activeDot={{ r: isMobile ? 4 : 6 }} 
                    animationDuration={1000}
                    isAnimationActive={true}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="temperature1" 
                    name="Temperature 2" 
                    stroke="#f59e0b" 
                    strokeWidth={2} 
                    dot={false} 
                    activeDot={{ r: isMobile ? 4 : 6 }} 
                    animationDuration={1000}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="humidity" className="mt-0">
            <div className="h-64 sm:h-72 chart-container px-2 sm:px-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={filteredData}
                  margin={{
                    top: 5,
                    right: isMobile ? 10 : 30,
                    left: isMobile ? -20 : 0,
                    bottom: 5
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="formattedTime" 
                    tick={{ fontSize: isMobile ? 10 : 12 }} 
                    interval={isMobile ? 'preserveEnd' : 'preserveStartEnd'}
                    minTickGap={10}
                  />
                  <YAxis 
                    unit="%" 
                    domain={['dataMin - 5', 'dataMax + 5']} 
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    width={isMobile ? 35 : 40}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    formatter={customTooltipFormatter}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }}
                    iconSize={isMobile ? 8 : 10}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="humidity0" 
                    name="Humidity 1" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    dot={false} 
                    activeDot={{ r: isMobile ? 4 : 6 }} 
                    animationDuration={1000}
                    isAnimationActive={true}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="humidity1" 
                    name="Humidity 2" 
                    stroke="#60a5fa" 
                    strokeWidth={2} 
                    dot={false} 
                    activeDot={{ r: isMobile ? 4 : 6 }} 
                    animationDuration={1000}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="moisture" className="mt-0">
            <div className="h-64 sm:h-72 chart-container px-2 sm:px-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={filteredData}
                  margin={{
                    top: 5,
                    right: isMobile ? 10 : 30,
                    left: isMobile ? -20 : 0,
                    bottom: 5
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="formattedTime" 
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    interval={isMobile ? 'preserveEnd' : 'preserveStartEnd'}
                    minTickGap={10}
                  />
                  <YAxis 
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    width={isMobile ? 35 : 40}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    formatter={customTooltipFormatter}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }}
                    iconSize={isMobile ? 8 : 10}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="moisture0" 
                    name="Section 1" 
                    stroke="#0ea5e9" 
                    strokeWidth={1.5} 
                    dot={false} 
                    activeDot={{ r: isMobile ? 4 : 5 }}
                    animationDuration={1000}
                    isAnimationActive={true}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="moisture1" 
                    name="Section 2" 
                    stroke="#38bdf8"
                    strokeWidth={1.5} 
                    dot={false} 
                    activeDot={{ r: isMobile ? 4 : 5 }}
                    animationDuration={1000}
                    isAnimationActive={true}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="moisture2" 
                    name="Section 3" 
                    stroke="#7dd3fc"
                    strokeWidth={1.5} 
                    dot={false} 
                    activeDot={{ r: isMobile ? 4 : 5 }}
                    animationDuration={1000}
                    isAnimationActive={true}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="moisture3" 
                    name="Section 4" 
                    stroke="#bae6fd"
                    strokeWidth={1.5} 
                    dot={false} 
                    activeDot={{ r: isMobile ? 4 : 5 }}
                    animationDuration={1000}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="co2" className="mt-0">
            <div className="h-64 sm:h-72 chart-container px-2 sm:px-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={filteredData}
                  margin={{
                    top: 5,
                    right: isMobile ? 10 : 30,
                    left: isMobile ? -20 : 0,
                    bottom: 5
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="formattedTime" 
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    interval={isMobile ? 'preserveEnd' : 'preserveStartEnd'}
                    minTickGap={10}
                  />
                  <YAxis 
                    unit=" ppm" 
                    domain={['dataMin - 50', 'dataMax + 50']} 
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                    width={isMobile ? 38 : 45}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    formatter={customTooltipFormatter}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }}
                    iconSize={isMobile ? 8 : 10}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="co2" 
                    name="CO₂ Level" 
                    stroke="#10b981" 
                    strokeWidth={2} 
                    dot={false} 
                    activeDot={{ r: isMobile ? 4 : 6 }} 
                    animationDuration={1000}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>;
};

export default HistoryChart;
