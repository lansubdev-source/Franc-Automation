"use client";
import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

// -------------------------------
// Types
// -------------------------------
export interface SensorData {
  device_name?: string;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  status?: "online" | "offline" | "warning";
  timestamp: string;
  deviceConnected?: boolean;
  isConnected?: boolean;
  devicesOnline?: number;
  device_id?: string;
}

// -------------------------------
// Time formatting (India time)
// -------------------------------
function formatIndiaTime(value?: string | number | Date): string {
  if (!value) return "--";
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

// -------------------------------
// useLiveData Hook
// -------------------------------
export function useLiveData() {
  const [currentData, setCurrentData] = useState<SensorData>({
    temperature: null,
    humidity: null,
    pressure: null,
    timestamp: "--",
    status: "offline",
    deviceConnected: false,
  });

  const [chartData, setChartData] = useState<SensorData[]>([]);
  const [tableData, setTableData] = useState<SensorData[]>([]);
  const [connected, setConnected] = useState(false);
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // -------------------------------
  // 🔁 Load and refresh latest data every 2 seconds
  // -------------------------------
  useEffect(() => {
    const loadLatest = async () => {
      try {
        const res = await fetch(`${API}/api/data/latest`);
        const latest = await res.json();

        if (latest && latest.temperature !== undefined) {
          const formatted: SensorData = {
            ...latest,
            device_name: latest.device_name || "Test device",
            timestamp: formatIndiaTime(latest.timestamp || new Date()),
            status: latest.status || "online",
            deviceConnected: true,
            isConnected: true,
            devicesOnline: latest.devices_online || 1,
          };
          setCurrentData(formatted);
          setChartData((prev) => [...prev.slice(-49), formatted]);
          setTableData((prev) => [formatted, ...prev.slice(0, 19)]);
          setIsDeviceConnected(true);
        }
      } catch (err) {
        console.error("[useLiveData] ❌ Failed to fetch latest data:", err);
      }
    };

    loadLatest(); // initial
    const interval = setInterval(loadLatest, 2000); // refresh every 2s
    return () => clearInterval(interval);
  }, []);

  // -------------------------------
  // 🔌 Real-time updates via Socket.IO
  // -------------------------------
  useEffect(() => {
    const socket = io(API, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket.IO] ✅ Connected to backend");
      setConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.warn("[Socket.IO] ⚠️ Disconnected:", reason);
      setConnected(false);
      setIsDeviceConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket.IO] ❌ Connection error:", err.message);
      setConnected(false);
    });

    // ✅ Sensor Data Event
    socket.on("sensor_data", (data: any) => {
      if (!data) return;
      const formatted: SensorData = {
        device_name: data.device_name || "Test device",
        temperature: data.temperature ?? null,
        humidity: data.humidity ?? null,
        pressure: data.pressure ?? null,
        status: data.status || "online",
        timestamp: formatIndiaTime(new Date()),
        deviceConnected: true,
        isConnected: true,
        devicesOnline: data.devices_online || 1,
        device_id: data.device_id,
      };

      setIsDeviceConnected(true);
      setCurrentData(formatted);
      setChartData((prev) => [...prev.slice(-49), formatted]);
      setTableData((prev) => [formatted, ...prev.slice(0, 19)]);
    });

    // ✅ Dashboard Data Event
    socket.on("dashboard_update", (data: any) => {
      if (!data) return;
      const formatted: SensorData = {
        device_name: data.device_name || "Test device",
        temperature: data.temperature ?? null,
        humidity: data.humidity ?? null,
        pressure: data.pressure ?? null,
        status: data.status || "online",
        timestamp: formatIndiaTime(data.timestamp || new Date()),
        deviceConnected: true,
        isConnected: true,
        devicesOnline: data.devices_online || 1,
        device_id: data.device_id,
      };

      setIsDeviceConnected(true);
      setCurrentData(formatted);
      setChartData((prev) => [...prev.slice(-49), formatted]);
      setTableData((prev) => [formatted, ...prev.slice(0, 19)]);
    });

    // ✅ MQTT Status Event
    socket.on("mqtt_status", (data: any) => {
      console.log("[Socket.IO] 🌐 MQTT Status:", data);
      if (data?.status === "connected") {
        setConnected(true);
        setIsDeviceConnected(true);
      } else {
        setConnected(false);
        setIsDeviceConnected(false);
      }
    });

    // Cleanup
    return () => {
      socket.disconnect();
      console.log("[Socket.IO] 🔌 Disconnected cleanly");
    };
  }, []);

  // -------------------------------
  // Return hook data
  // -------------------------------
  return {
    currentData,
    chartData,
    tableData,
    connected,
    isDeviceConnected,
  };
}
