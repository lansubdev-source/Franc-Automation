"use client";
import { useEffect, useState, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MetricCard, CircularGauge, RealtimeChart } from "@/pages/Dashboard";
import { useLiveData } from "@/hooks/useLiveData";
import { Thermometer, Droplets, Gauge, Wifi } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

// ---------------------------------------------
// Format to India Time
// ---------------------------------------------
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
  const { currentData, chartData } = useLiveData("dashboard");

  const [lastUpdated, setLastUpdated] = useState<string>("—");
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [pressure, setPressure] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);

  // Track last live update
  const lastMessageTimeRef = useRef<number>(Date.now());
  const offlineTimerRef = useRef<NodeJS.Timeout | null>(null);

  // =========================================================
  // 🔥 REAL-TIME SOCKET UPDATES
  // =========================================================
  useEffect(() => {
    if (!currentData) return;

    const online =
      currentData?.deviceConnected ||
      currentData?.isConnected ||
      (currentData?.devicesOnline ?? 0) > 0;

    if (online) {
      lastMessageTimeRef.current = Date.now();

      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = setTimeout(() => {
        const diff = Date.now() - lastMessageTimeRef.current;
        if (diff > 8000) setIsOnline(false);
      }, 9000);
    }

    setIsOnline(Boolean(online));

    if (online) {
      setTemperature(currentData.temperature ?? temperature);
      setHumidity(currentData.humidity ?? humidity);
      setPressure(currentData.pressure ?? pressure);
      setLastUpdated(formatIndiaTime(currentData.timestamp));
    }
  }, [currentData]);

  // =========================================================
  // 🔁 FALLBACK POLLING — when socket lags >8s
  // =========================================================
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/data/latest`);
        const data = await res.json();
        if (!data) return;

        const online =
          data.status === "online" || (data.devices_online ?? 0) > 0;

        if (online) {
          lastMessageTimeRef.current = Date.now();

          if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
          offlineTimerRef.current = setTimeout(() => {
            const diff = Date.now() - lastMessageTimeRef.current;
            if (diff > 8000) setIsOnline(false);
          }, 9000);
        }

        setIsOnline(online);

        if (online) {
          setTemperature(data.temperature ?? temperature);
          setHumidity(data.humidity ?? humidity);
          setPressure(data.pressure ?? pressure);
          setLastUpdated(formatIndiaTime(data.timestamp));
        }
      } catch (err) {
        console.error("[DashboardPage Polling Error]", err);
      }
    }, 4000);

    return () => {
      clearInterval(interval);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
    };
  }, [temperature, humidity, pressure]);

  // =========================================================
  // ⏱ Update display clock
  // =========================================================
  const [systemTime, setSystemTime] = useState<string>(formatIndiaTime());
  useEffect(() => {
    const timer = setInterval(() => setSystemTime(formatIndiaTime()), 2000);
    return () => clearInterval(timer);
  }, []);

  // =========================================================
  // STATUS HELPERS
  // =========================================================
  const getTemperatureStatus = (temp: number | null) =>
    !isOnline
      ? "critical"
      : temp && temp > 35
      ? "critical"
      : temp && temp > 30
      ? "warning"
      : "good";

  const getHumidityStatus = (hum: number | null) =>
    !isOnline
      ? "critical"
      : hum && (hum > 70 || hum < 30)
      ? "warning"
      : "good";

  const temperaturePercent = Math.min(100, ((temperature ?? 0) / 50) * 100);
  const humidityPercent = Math.min(100, humidity ?? 0);

  // =========================================================
  // UI RENDER
  // =========================================================
  return (
    <DashboardLayout>
      <div className="space-y-6 text-white bg-[#0d1117] p-6 min-h-screen">
        {/* -------- Header -------- */}
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

        {/* -------- Metric Cards -------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Temperature"
            value={temperature !== null && isOnline ? temperature.toFixed(1) : "—"}
            unit="°C"
            icon={<Thermometer className="w-5 h-5 text-primary" />}
            status={getTemperatureStatus(temperature)}
          />
          <MetricCard
            title="Humidity"
            value={humidity !== null && isOnline ? humidity.toFixed(1) : "—"}
            unit="%"
            icon={<Droplets className="w-5 h-5 text-primary" />}
            status={getHumidityStatus(humidity)}
          />
          <MetricCard
            title="Pressure"
            value={pressure !== null && isOnline ? pressure.toFixed(2) : "—"}
            unit="hPa"
            icon={<Gauge className="w-5 h-5 text-primary" />}
            status={isOnline ? "good" : "critical"}
          />
          <MetricCard
            title="Devices Online"
            value={isOnline ? 1 : 0}
            icon={<Wifi className="w-5 h-5 text-primary" />}
            status={isOnline ? "good" : "critical"}
          />
        </div>

        {/* -------- Chart + Gauges -------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RealtimeChart data={isOnline ? chartData : []} />
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-[#161b22] p-5 rounded-2xl shadow-md">
              <h3 className="text-white text-lg font-semibold mb-4">
                Temperature Gauge
              </h3>
              <CircularGauge
                title="Temperature"
                value={isOnline ? temperature ?? 0 : 0}
                percentage={temperaturePercent}
                unit="°C"
                label={isOnline ? `${Math.round(temperaturePercent)}%` : "Offline"}
              />
            </div>

            <div className="bg-[#161b22] p-5 rounded-2xl shadow-md">
              <h3 className="text-white text-lg font-semibold mb-4">
                Humidity Gauge
              </h3>
              <CircularGauge
                title="Humidity"
                value={isOnline ? humidity ?? 0 : 0}
                percentage={humidityPercent}
                unit="%"
                label={isOnline ? `${Math.round(humidityPercent)}%` : "Offline"}
              />
            </div>
          </div>
        </div>

        {/* -------- Footer -------- */}
        <div className="text-center text-gray-400 text-xs pt-6 border-t border-gray-800">
          <p>Last refreshed: {systemTime}</p>
          {!isOnline && (
            <p className="italic text-gray-500 mt-1">
              No active device connection — waiting for data...
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
