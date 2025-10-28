"use client";
import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import Sidebar from "@/components/dashboard/Sidebar";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ---------------- METRIC CARD ----------------
interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
  status?: "good" | "warning" | "critical";
  color?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  icon,
  trend,
  trendValue,
  status = "good",
  color,
}) => {
  const statusColors = {
    good: "text-green-400",
    warning: "text-yellow-400",
    critical: "text-red-500",
  };

  return (
    <div
      className={`p-5 rounded-2xl shadow-md bg-gradient-to-br ${
        color || "from-slate-700 to-slate-900"
      } text-white`}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm uppercase tracking-wide text-gray-100">
          {title}
        </span>
        <span className="text-2xl">{icon}</span>
      </div>
      <h2 className="text-3xl font-bold">
        {value}
        {unit && <span className="text-lg font-medium ml-1">{unit}</span>}
      </h2>
      {trendValue && (
        <p
          className={`text-sm mt-1 ${
            trend === "up"
              ? "text-green-400"
              : trend === "down"
              ? "text-red-400"
              : "text-gray-300"
          }`}
        >
          {trend === "up" && "▲ "}
          {trend === "down" && "▼ "}
          {trend === "stable" && "▬ "}
          {trendValue}
        </p>
      )}
      <p className={`text-xs mt-2 ${statusColors[status]}`}>
        Status: {status.toUpperCase()}
      </p>
    </div>
  );
};

// ---------------- CIRCULAR GAUGE ----------------
interface CircularGaugeProps {
  title?: string;
  value?: number;
  min?: number;
  max?: number;
  unit?: string;
  thresholds?: { warning: number; critical: number };
  percentage?: number;
  label?: string;
}

const CircularGauge: React.FC<CircularGaugeProps> = ({
  title,
  value,
  min = 0,
  max = 100,
  unit,
  thresholds = { warning: 70, critical: 85 },
  percentage,
  label,
}) => {
  const actualValue = percentage ?? ((value! - min) / (max - min)) * 100;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (actualValue / 100) * circumference;

  const gaugeColor =
    value && value >= thresholds.critical
      ? "#ef4444"
      : value && value >= thresholds.warning
      ? "#facc15"
      : "#3b82f6";

  return (
    <div className="flex flex-col items-center justify-center text-center">
      {title && (
        <h4 className="text-sm font-semibold mb-2 text-gray-300">{title}</h4>
      )}
      <svg width="120" height="120" className="-rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="#374151"
          strokeWidth="10"
          fill="none"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke={gaugeColor}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
        />
        <text
          x="60"
          y="60"
          textAnchor="middle"
          dominantBaseline="middle"
          className="rotate-90 text-white text-lg font-semibold"
        >
          {value
            ? `${Math.round(value)}${unit || ""}`
            : `${Math.round(actualValue)}%`}
        </text>
      </svg>
      <p className="mt-3 text-sm text-gray-300">{label}</p>
    </div>
  );
};

// ---------------- REALTIME CHART ----------------
interface RealtimeChartProps {
  title?: string;
  data: any[];
  lines?: { key: string; color: string; name: string }[];
}

const RealtimeChart: React.FC<RealtimeChartProps> = ({ data }) => (
  <div className="bg-[#161b22] p-5 rounded-2xl shadow-md">
    <h3 className="text-white text-lg font-semibold mb-4">
      Real-Time Sensor Data
    </h3>
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <XAxis dataKey="timestamp" stroke="#8884d8" />
        <YAxis stroke="#8884d8" />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "none",
            borderRadius: "8px",
          }}
          labelStyle={{ color: "#fff" }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="temperature"
          stroke="#ef4444"
          dot={false}
          name="Temperature (°C)"
        />
        <Line
          type="monotone"
          dataKey="humidity"
          stroke="#3b82f6"
          dot={false}
          name="Humidity (%)"
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

// ---------------- MAIN DASHBOARD ----------------
export default function Dashboard() {
  const [temperature, setTemperature] = useState<number>(0);
  const [humidity, setHumidity] = useState<number>(0);
  const [pressure, setPressure] = useState<number>(0);
  const [devicesOnline, setDevicesOnline] = useState<number>(0);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const socket = io("http://127.0.0.1:5000"); // ✅ Flask backend

    socket.on("connect", () => {
      console.log("[Socket] ✅ Connected to backend");
    });

    // ✅ Correct event listener for real-time updates
    socket.on("dashboard_update", (data) => {
      console.log("[Socket] 📊 Dashboard update:", data);

      // Defensive checks for missing keys
      setTemperature(data?.temperature ?? 0);
      setHumidity(data?.humidity ?? 0);
      setPressure(data?.pressure ?? 0);
      setDevicesOnline(data?.devices_online ?? data?.devicesOnline ?? 0); // ✅ supports both key styles

      // Append to chart (limit 20 points)
      setChartData((prev) => [
        ...prev.slice(-19),
        {
          timestamp: new Date().toLocaleTimeString(),
          temperature: data?.temperature ?? 0,
          humidity: data?.humidity ?? 0,
        },
      ]);
    });

    socket.on("disconnect", () => {
      console.log("[Socket] ❌ Disconnected from backend");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="flex h-full bg-[#0d1117] text-white">
        <Sidebar />
        <main className="flex-1 p-6 overflow-y-auto space-y-8">
          {/* HEADER */}
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-white">
              Dashboard Overview
            </h1>
            <span className="text-sm text-gray-400">
              {new Date().toLocaleDateString()}
            </span>
          </div>

          {/* METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Air Temperature"
              value={temperature.toFixed(1)}
              unit="°C"
              icon="🌡️"
              color="from-blue-500 to-blue-700"
              status={temperature > 30 ? "critical" : "good"}
            />
            <MetricCard
              title="Humidity"
              value={humidity.toFixed(1)}
              unit="%"
              icon="💧"
              color="from-teal-500 to-cyan-600"
            />
            <MetricCard
              title="Pressure"
              value={pressure.toFixed(2)}
              unit="hPa"
              icon="⚙️"
              color="from-indigo-500 to-blue-700"
            />
            <MetricCard
              title="Devices Online"
              value={devicesOnline}
              icon="📡"
              color="from-green-500 to-emerald-700"
            />
          </div>

          {/* CHART + GAUGES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            <div className="lg:col-span-2">
              <RealtimeChart data={chartData} />
            </div>
            <div className="bg-[#161b22] p-5 rounded-2xl shadow-md flex flex-col items-center justify-center">
              <h3 className="text-white text-lg font-semibold mb-4">
                System Performance
              </h3>
              <div className="grid grid-cols-2 gap-8">
                <CircularGauge percentage={78} label="CPU Usage" />
                <CircularGauge percentage={64} label="Memory" />
                <CircularGauge percentage={49} label="Network" />
                <CircularGauge percentage={82} label="Storage" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}

export { MetricCard, CircularGauge, RealtimeChart };
