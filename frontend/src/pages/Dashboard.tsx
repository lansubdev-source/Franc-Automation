"use client";
import React, { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useLiveData } from "@/hooks/useLiveData";

// ---------------- METRIC CARD ----------------
interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  status?: "good" | "warning" | "critical";
  color?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  icon,
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
      } text-white transition-all duration-500`}
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
  value = 0,
  min = 0,
  max = 100,
  unit,
  thresholds = { warning: 70, critical: 85 },
  percentage,
  label,
}) => {
  const computedPercentage =
    percentage !== undefined
      ? Math.min(100, Math.max(0, percentage))
      : Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (computedPercentage / 100) * circumference;

  const gaugeColor =
    value >= thresholds.critical
      ? "#ef4444"
      : value >= thresholds.warning
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
          style={{
            transition: "stroke-dashoffset 0.5s ease, stroke 0.5s ease",
          }}
        />
        <text
          x="60"
          y="55"
          textAnchor="middle"
          dominantBaseline="middle"
          className="rotate-90 text-white text-xl font-bold"
        >
          {Math.round(value)}
          {unit || ""}
        </text>
        <text
          x="60"
          y="75"
          textAnchor="middle"
          dominantBaseline="middle"
          className="rotate-90 text-gray-400 text-xs"
        >
          {Math.round(computedPercentage)}%
        </text>
      </svg>
      {label && <p className="mt-3 text-sm text-gray-300">{label}</p>}
    </div>
  );
};

// ---------------- REALTIME CHART ----------------
const RealtimeChart = ({ data }: { data: any[] }) => (
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
  const { currentData, chartData, isDeviceConnected } =
    useLiveData("dashboard");

  const temperature = currentData?.temperature ?? null;
  const humidity = currentData?.humidity ?? null;
  const pressure = currentData?.pressure ?? null;
  const devicesOnline = currentData?.devicesOnline ?? 0;
  const lastUpdate = currentData?.timestamp ?? "--";
  const isOnline = isDeviceConnected;

  const [currentTime, setCurrentTime] = useState<string>("--");

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: true,
        })
      );
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <DashboardLayout>
      <div className="flex h-full bg-[#0d1117] text-white">
        <main className="flex-1 p-6 overflow-y-auto space-y-8">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-white">
                Dashboard Overview
              </h1>
              <div className="flex items-center gap-3 text-sm mt-1">
                {isOnline ? (
                  <div className="flex items-center text-green-500 gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>🟢 Online</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-500 gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>🔴 Offline</span>
                  </div>
                )}
                <span className="text-gray-500">|</span>
                <span className="text-gray-400">{currentTime}</span>
              </div>
            </div>
            <span className="text-sm text-gray-400">
              Last updated: {lastUpdate}
            </span>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Temperature"
              value={
                temperature !== null && isOnline ? temperature.toFixed(1) : "--"
              }
              unit="°C"
              icon="🌡️"
              status={
                !isOnline
                  ? "critical"
                  : temperature && temperature > 35
                  ? "critical"
                  : temperature && temperature > 30
                  ? "warning"
                  : "good"
              }
              color="from-blue-500 to-blue-700"
            />
            <MetricCard
              title="Humidity"
              value={
                humidity !== null && isOnline ? humidity.toFixed(1) : "--"
              }
              unit="%"
              icon="💧"
              status={
                !isOnline
                  ? "critical"
                  : humidity && humidity > 70
                  ? "warning"
                  : "good"
              }
              color="from-teal-500 to-cyan-600"
            />
            <MetricCard
              title="Pressure"
              value={
                pressure !== null && isOnline ? pressure.toFixed(2) : "--"
              }
              unit="hPa"
              icon="⚙️"
              color="from-indigo-500 to-blue-700"
            />
            <MetricCard
              title="Devices Online"
              value={devicesOnline}
              icon="📡"
              status={isOnline ? "good" : "critical"}
              color="from-green-500 to-emerald-700"
            />
          </div>

          {/* Chart + Gauges */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            <div className="lg:col-span-2">
              <RealtimeChart data={chartData} />
            </div>

            <div className="bg-[#161b22] p-5 rounded-2xl shadow-md flex flex-col items-center justify-center">
              <h3 className="text-white text-lg font-semibold mb-4">
                Sensor Gauges
              </h3>
              <div className="flex flex-col gap-8">
                <CircularGauge
                  title="Temperature"
                  value={temperature ?? 0}
                  unit="°C"
                  label={isOnline ? "Current Temp" : "Offline"}
                />
                <CircularGauge
                  title="Humidity"
                  value={humidity ?? 0}
                  unit="%"
                  label={isOnline ? "Current Humidity" : "Offline"}
                />
              </div>
              {!isOnline && (
                <p className="text-sm text-gray-500 mt-6 italic">
                  No device connected — awaiting data...
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}

export { MetricCard, CircularGauge, RealtimeChart };
