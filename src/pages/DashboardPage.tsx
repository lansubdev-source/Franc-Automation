import {DashboardLayout} from '@/components/dashboard/DashboardLayout';
import { MetricCard, CircularGauge, RealtimeChart } from '@/pages/Dashboard';
import { useLiveData } from '@/hooks/useLiveData';
import { Thermometer, Droplets, Gauge, Wifi } from 'lucide-react';

const DashboardPage = () => {
  const { currentData, chartData, tableData } = useLiveData();

  const getTemperatureStatus = (temp: number) => {
    if (temp > 30) return 'critical';
    if (temp > 25) return 'warning';
    return 'good';
  };

  const getHumidityStatus = (humidity: number) => {
    if (humidity > 70 || humidity < 30) return 'warning';
    return 'good';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">IoT Dashboard</h1>
            <p className="text-muted-foreground">Real-time MQTT sensor monitoring</p>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-metric-good rounded-full animate-pulse"></div>
              <span>Live</span>
            </div>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">Last update: {currentData.timestamp}</span>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Temperature"
            value={Math.round(currentData.temperature * 10) / 10}
            unit="°C"
            icon={<Thermometer className="w-5 h-5 text-primary" />}
            trend="stable"
            trendValue="0.2°C"
            status={getTemperatureStatus(currentData.temperature)}
          />
          <MetricCard
            title="Humidity"
            value={Math.round(currentData.humidity)}
            unit="%"
            icon={<Droplets className="w-5 h-5 text-primary" />}
            trend="down"
            trendValue="2%"
            status={getHumidityStatus(currentData.humidity)}
          />
          <MetricCard
            title="Pressure"
            value={Math.round(currentData.pressure * 100) / 100}
            unit="hPa"
            icon={<Gauge className="w-5 h-5 text-primary" />}
            trend="up"
            trendValue="1.2 hPa"
            status="good"
          />
          <MetricCard
            title="Devices Online"
            value={3}
            unit=""
            icon={<Wifi className="w-5 h-5 text-primary" />}
            trend="stable"
            trendValue="3/3"
            status="good"
          />
        </div>

        {/* Charts and Gauges */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RealtimeChart
              title="Real-time Sensor Data"
              data={chartData}
              lines={[
                { key: 'temperature', color: '#ef4444', name: 'Temperature (°C)' },
                { key: 'humidity', color: '#3b82f6', name: 'Humidity (%)' },
              ]}
            />
          </div>
          <div className="space-y-6">
            <CircularGauge
              title="Temperature"
              value={Math.round(currentData.temperature * 10) / 10}
              min={0}
              max={50}
              unit="°C"
              thresholds={{ warning: 25, critical: 30 }}
            />
            <CircularGauge
              title="Humidity"
              value={Math.round(currentData.humidity)}
              min={0}
              max={100}
              unit="%"
              thresholds={{ warning: 70, critical: 85 }}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
