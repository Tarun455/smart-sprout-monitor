
import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getHistoryData, HistoryDataPoint } from '@/services/firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, TooltipProps } from 'recharts';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatInTimeZone } from 'date-fns-tz';
import { TrendingUp } from 'lucide-react';

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

    if (name === 'temperature0') { displayName = 'Greenhouse Temperature 1'; unit = '°C'; }
    if (name === 'temperature1') { displayName = 'Greenhouse Temperature 2'; unit = '°C'; }
    if (name === 'temperature2') { displayName = 'Outside Temperature 3'; unit = '°C'; }
    if (name === 'humidity0') { displayName = 'Greenhouse Humidity 1'; unit = '%'; }
    if (name === 'humidity1') { displayName = 'Greenhouse Humidity 2'; unit = '%'; }
    if (name === 'humidity2') { displayName = 'Outside Humidity 3'; unit = '%'; }
    if (name === 'soilTemperature0') { displayName = 'Soil Temperature 1'; unit = '°C'; }
    if (name === 'soilTemperature1') { displayName = 'Soil Temperature 2'; unit = '°C'; }
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
        <div className="custom-tooltip bg-background/95 backdrop-blur-sm p-2 sm:p-3 shadow-lg rounded-md border border-border max-w-[200px] sm:max-w-none">
          <p className="text-xs text-muted-foreground mb-1 truncate">{fullTimestamp}</p>
          <div className="sensor-values space-y-0.5">
            {payload.map((entry: any, index: number) => {
              // Determine unit based on data type
              let unit = '';
              if (entry.name.startsWith('temperature') || entry.name.startsWith('soilTemperature')) unit = '°C';
              if (entry.name.startsWith('humidity')) unit = '%';

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
    return <div className="animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 bg-muted rounded"></div>
        <div className="h-8 w-32 bg-muted rounded"></div>
      </div>
      <div className="h-64 bg-muted rounded"></div>
    </div>;
  }

  if (historyData.length === 0) {
    return <div>
      <div className="flex items-center space-x-2 mb-4">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="font-medium text-foreground">Sensor History</h3>
      </div>
      <div className="h-64 flex items-center justify-center text-muted-foreground bg-card/30 rounded-lg border border-border/50">
        <div className="text-center">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm">Waiting for data collection...</p>
        </div>
      </div>
    </div>;
  }

  return <div className="fade-in">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4">
      <div className="flex items-center space-x-2">
        <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
        <div>
          <h3 className="font-medium text-foreground">Sensor History</h3>
          <p className="text-xs text-muted-foreground hidden sm:block">Historical data trends</p>
        </div>
      </div>
      <div className="w-full sm:w-auto">
        <Select
          value={timeRange}
          onValueChange={(value) => setTimeRange(value as TimeRange)}
        >
          <SelectTrigger className="w-full sm:w-[140px] bg-card/50 border-border/50 h-9">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent className="animate-none" side="bottom" align="end">
            <SelectItem value="hour">1H</SelectItem>
            <SelectItem value="day">24H</SelectItem>
            <SelectItem value="week">7D</SelectItem>
            <SelectItem value="month">30D</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    <Tabs defaultValue="temperature" className="w-full">
      <TabsList className="mb-3 sm:mb-4 w-full bg-card/50 border border-border/50 grid grid-cols-4 h-9 sm:h-10">
        <TabsTrigger value="temperature" className="text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-1 sm:px-3">
          <span className="hidden sm:inline">TEMPERATURE</span>
          <span className="sm:hidden">TEMP</span>
        </TabsTrigger>
        <TabsTrigger value="humidity" className="text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-1 sm:px-3">
          <span className="hidden sm:inline">HUMIDITY</span>
          <span className="sm:hidden">HUM</span>
        </TabsTrigger>
        <TabsTrigger value="moisture" className="text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-1 sm:px-3">
          <span className="hidden sm:inline">MOISTURE</span>
          <span className="sm:hidden">MOIST</span>
        </TabsTrigger>
        <TabsTrigger value="soilTemperature" className="text-xs sm:text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-1 sm:px-3">
          <span className="hidden sm:inline">SOIL TEMP</span>
          <span className="sm:hidden">SOIL</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="temperature" className="mt-0">
        <div className="h-64 sm:h-64 lg:h-72 bg-card/30 rounded-lg border border-border/50 p-2 sm:p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={filteredData}
              margin={{
                top: 10,
                right: isMobile ? 15 : 30,
                left: isMobile ? 10 : 20,
                bottom: isMobile ? 25 : 5
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.5} />
              <XAxis
                dataKey="formattedTime"
                tick={{ fontSize: isMobile ? 10 : 12 }}
                interval={isMobile ? Math.max(Math.floor(filteredData.length / 4), 0) : 'preserveStartEnd'}
                minTickGap={isMobile ? 30 : 10}
                height={isMobile ? 25 : 30}
                axisLine={true}
                tickLine={true}
              />
              <YAxis
                unit="°C"
                domain={['dataMin - 2', 'dataMax + 2']}
                tick={{ fontSize: isMobile ? 10 : 12 }}
                width={isMobile ? 35 : 40}
                axisLine={true}
                tickLine={true}
              />
              <Tooltip
                content={<CustomTooltip />}
                formatter={customTooltipFormatter}
              />
              {!isMobile && (
                <Legend
                  wrapperStyle={{ fontSize: '12px' }}
                  iconSize={10}
                />
              )}
              <Line
                type="monotone"
                dataKey="temperature0"
                name={isMobile ? "GH1" : "Greenhouse Sensor 1"}
                stroke="hsl(var(--primary))"
                strokeWidth={isMobile ? 2 : 2}
                dot={false}
                activeDot={{ r: isMobile ? 4 : 6, fill: "hsl(var(--primary))" }}
                animationDuration={300}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="temperature1"
                name={isMobile ? "GH2" : "Greenhouse Sensor 2"}
                stroke="hsl(var(--primary))"
                strokeOpacity={0.7}
                strokeWidth={isMobile ? 2 : 2}
                dot={false}
                activeDot={{ r: isMobile ? 4 : 6, fill: "hsl(var(--primary))" }}
                animationDuration={300}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="temperature2"
                name={isMobile ? "Out" : "Outside Sensor 3"}
                stroke="#f59e0b"
                strokeWidth={isMobile ? 2 : 2}
                dot={false}
                activeDot={{ r: isMobile ? 4 : 6, fill: "#f59e0b" }}
                animationDuration={300}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      <TabsContent value="humidity" className="mt-0">
        <div className="h-64 sm:h-64 lg:h-72 bg-card/30 rounded-lg border border-border/50 p-2 sm:p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={filteredData}
              margin={{
                top: 10,
                right: isMobile ? 15 : 30,
                left: isMobile ? 10 : 20,
                bottom: isMobile ? 25 : 5
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.5} />
              <XAxis
                dataKey="formattedTime"
                tick={{ fontSize: isMobile ? 10 : 12 }}
                interval={isMobile ? Math.max(Math.floor(filteredData.length / 4), 0) : 'preserveStartEnd'}
                minTickGap={isMobile ? 30 : 10}
                height={isMobile ? 25 : 30}
                axisLine={true}
                tickLine={true}
              />
              <YAxis
                unit="%"
                domain={['dataMin - 5', 'dataMax + 5']}
                tick={{ fontSize: isMobile ? 10 : 12 }}
                width={isMobile ? 35 : 40}
                axisLine={true}
                tickLine={true}
              />
              <Tooltip
                content={<CustomTooltip />}
                formatter={customTooltipFormatter}
              />
              {!isMobile && (
                <Legend
                  wrapperStyle={{ fontSize: '12px' }}
                  iconSize={10}
                />
              )}
              <Line
                type="monotone"
                dataKey="humidity0"
                name={isMobile ? "GH1" : "Greenhouse Humidity 1"}
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: isMobile ? 4 : 6 }}
                animationDuration={300}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="humidity1"
                name={isMobile ? "GH2" : "Greenhouse Humidity 2"}
                stroke="#60a5fa"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: isMobile ? 4 : 6 }}
                animationDuration={300}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="humidity2"
                name={isMobile ? "Out" : "Outside Humidity 3"}
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: isMobile ? 4 : 6 }}
                animationDuration={300}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      <TabsContent value="moisture" className="mt-0">
        <div className="h-64 sm:h-64 lg:h-72 bg-card/30 rounded-lg border border-border/50 p-2 sm:p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={filteredData}
              margin={{
                top: 10,
                right: isMobile ? 15 : 30,
                left: isMobile ? 10 : 20,
                bottom: isMobile ? 25 : 5
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.5} />
              <XAxis
                dataKey="formattedTime"
                tick={{ fontSize: isMobile ? 10 : 12 }}
                interval={isMobile ? Math.max(Math.floor(filteredData.length / 4), 0) : 'preserveStartEnd'}
                minTickGap={isMobile ? 30 : 10}
                height={isMobile ? 25 : 30}
                axisLine={true}
                tickLine={true}
              />
              <YAxis
                tick={{ fontSize: isMobile ? 10 : 12 }}
                width={isMobile ? 35 : 40}
                axisLine={true}
                tickLine={true}
              />
              <Tooltip
                content={<CustomTooltip />}
                formatter={customTooltipFormatter}
              />
              {!isMobile && (
                <Legend
                  wrapperStyle={{ fontSize: '12px' }}
                  iconSize={10}
                />
              )}
              <Line
                type="monotone"
                dataKey="moisture0"
                name={isMobile ? "S1" : "Section 1"}
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: isMobile ? 4 : 5 }}
                animationDuration={300}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="moisture1"
                name={isMobile ? "S2" : "Section 2"}
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: isMobile ? 4 : 5 }}
                animationDuration={300}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="moisture2"
                name={isMobile ? "S3" : "Section 3"}
                stroke="#7dd3fc"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: isMobile ? 4 : 5 }}
                animationDuration={300}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="moisture3"
                name={isMobile ? "S4" : "Section 4"}
                stroke="#bae6fd"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: isMobile ? 4 : 5 }}
                animationDuration={300}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      <TabsContent value="soilTemperature" className="mt-0">
        <div className="h-64 sm:h-64 lg:h-72 bg-card/30 rounded-lg border border-border/50 p-2 sm:p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={filteredData}
              margin={{
                top: 10,
                right: isMobile ? 15 : 30,
                left: isMobile ? 10 : 20,
                bottom: isMobile ? 25 : 5
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" opacity={0.5} />
              <XAxis
                dataKey="formattedTime"
                tick={{ fontSize: isMobile ? 10 : 12 }}
                interval={isMobile ? Math.max(Math.floor(filteredData.length / 4), 0) : 'preserveStartEnd'}
                minTickGap={isMobile ? 30 : 10}
                height={isMobile ? 25 : 30}
                axisLine={true}
                tickLine={true}
              />
              <YAxis
                unit="°C"
                domain={['dataMin - 2', 'dataMax + 2']}
                tick={{ fontSize: isMobile ? 10 : 12 }}
                width={isMobile ? 35 : 40}
                axisLine={true}
                tickLine={true}
              />
              <Tooltip
                content={<CustomTooltip />}
                formatter={customTooltipFormatter}
              />
              {!isMobile && (
                <Legend
                  wrapperStyle={{ fontSize: '12px' }}
                  iconSize={10}
                />
              )}
              <Line
                type="monotone"
                dataKey="soilTemperature0"
                name={isMobile ? "Soil1" : "Soil Sensor 1"}
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: isMobile ? 4 : 6, fill: "#8b5cf6" }}
                animationDuration={300}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="soilTemperature1"
                name={isMobile ? "Soil2" : "Soil Sensor 2"}
                stroke="#d946ef"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: isMobile ? 4 : 6, fill: "#d946ef" }}
                animationDuration={300}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>
    </Tabs>
  </div >;
};

export default HistoryChart;
