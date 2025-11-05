"use client";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MetricCard, CircularGauge, RealtimeChart } from "@/pages/Dashboard";
import { useLiveData } from "@/hooks/useLiveData";
import { Thermometer, Droplets, Gauge, Wifi } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

// ✅ Format to India time
function formatIndiaTime(value?: string | number | Date) {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

const DashboardPage = () => {
  const { currentData, chartData } = useLiveData();
  const [lastUpdated, setLastUpdated] = useState<string>(formatIndiaTime());
  const [temperature, setTemperature] = useState<number>(0);
  const [humidity, setHumidity] = useState<number>(0);
  const [pressure, setPressure] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(false);

  // 🔁 Update on live socket data
  useEffect(() => {
    if (currentData) {
      setTemperature(currentData?.temperature ?? 0);
      setHumidity(currentData?.humidity ?? 0);
      setPressure(currentData?.pressure ?? 0);
      setIsOnline(
        currentData?.deviceConnected ||
          currentData?.isConnected ||
          (currentData?.devicesOnline ?? 0) > 0
      );
      setLastUpdated(formatIndiaTime(currentData?.timestamp || new Date()));
    }
  }, [currentData]);

  // 🔁 Fallback polling every 2s (ensures stable refresh even if socket drops)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/data/latest`);
        const data = await res.json();
        if (!data) return;

        setTemperature(data.temperature ?? temperature);
        setHumidity(data.humidity ?? humidity);
        setPressure(data.pressure ?? pressure);
        setIsOnline(data.status === "online" || true);
        setLastUpdated(formatIndiaTime(data.timestamp || new Date()));
      } catch (err) {
        console.error("[DashboardPage polling error]", err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [temperature, humidity, pressure]);

  // ⏱ Keep showing system time in footer
  const [systemTime, setSystemTime] = useState<string>(formatIndiaTime());
  useEffect(() => {
    const timer = setInterval(() => setSystemTime(formatIndiaTime()), 2000);
    return () => clearInterval(timer);
  }, []);

  // ✅ Status helpers
  const getTemperatureStatus = (temp: number) =>
    temp > 35 ? "critical" : temp > 30 ? "warning" : "good";

  const getHumidityStatus = (humidity: number) =>
    humidity > 70 || humidity < 30 ? "warning" : "good";

  // ✅ Percentage for gauges
  const temperaturePercent = Math.min(100, (temperature / 50) * 100);
  const humidityPercent = Math.min(100, humidity);

  return (
    <DashboardLayout>
      <div className="space-y-6 text-white bg-[#0d1117] p-6 min-h-screen">
        {/* ---------- Header ---------- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Franc Automation</h1>
            <p className="text-gray-400">Real-time MQTT sensor monitoring</p>
          </div>

          <div className="flex items-center space-x-3 text-sm">
            {isOnline ? (
              <div className="flex items-center space-x-1 text-green-500">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Online</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-red-500">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Offline</span>
              </div>
            )}
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">
              Last update: {lastUpdated || "—"}
            </span>
          </div>
        </div>

        {/* ---------- Metric Cards ---------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Temperature"
            value={temperature ? temperature.toFixed(1) : "—"}
            unit="°C"
            icon={<Thermometer className="w-5 h-5 text-primary" />}
            status={getTemperatureStatus(temperature)}
          />
          <MetricCard
            title="Humidity"
            value={humidity ? humidity.toFixed(1) : "—"}
            unit="%"
            icon={<Droplets className="w-5 h-5 text-primary" />}
            status={getHumidityStatus(humidity)}
          />
          <MetricCard
            title="Pressure"
            value={pressure ? pressure.toFixed(2) : "—"}
            unit="hPa"
            icon={<Gauge className="w-5 h-5 text-primary" />}
            status="good"
          />
          <MetricCard
            title="Devices Online"
            value={isOnline ? 1 : 0}
            icon={<Wifi className="w-5 h-5 text-primary" />}
            status={isOnline ? "good" : "critical"}
          />
        </div>

        {/* ---------- Chart + Gauges ---------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RealtimeChart data={chartData} />
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-[#161b22] p-5 rounded-2xl shadow-md">
              <h3 className="text-white text-lg font-semibold mb-4">
                Temperature Gauge
              </h3>
              <CircularGauge
                title="Temperature"
                value={temperature}
                percentage={temperaturePercent}
                unit="°C"
                label={`${Math.round(temperaturePercent)}%`}
              />
            </div>

            <div className="bg-[#161b22] p-5 rounded-2xl shadow-md">
              <h3 className="text-white text-lg font-semibold mb-4">
                Humidity Gauge
              </h3>
              <CircularGauge
                title="Humidity"
                value={humidity}
                percentage={humidityPercent}
                unit="%"
                label={`${Math.round(humidityPercent)}%`}
              />
            </div>
          </div>
        </div>

        {/* ---------- Footer ---------- */}
        <div className="text-center text-gray-400 text-xs pt-6 border-t border-gray-800">
          <p>Last refreshed: {systemTime}</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
