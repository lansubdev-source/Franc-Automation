// ==============================================
// useLiveData.ts (Stable Anti-Flicker Version v3)
// ==============================================
"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

// Prefer env variable, fallback to localhost
const API =
  (import.meta as any).env?.VITE_API_URL || "http://127.0.0.1:5000";

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
  device_id?: string | number;
}

// -------------------------------
// Helper: Format to India Time
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
// MAIN HOOK
// -------------------------------
export function useLiveData(page: "dashboard" | "live" = "dashboard") {
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
  const lastUpdateRef = useRef<number>(Date.now());

  // Timer that marks offline ONLY after no messages for long time
  const offlineTimerRef = useRef<number | null>(null);

  // -------------------------------
  // 🔌 SOCKET REAL-TIME HANDLING
  // -------------------------------
  useEffect(() => {
    const socket = io(API, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    // Connection status logs
    socket.on("connect", () => {
      console.log("[Socket.IO] Connected");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.warn("[Socket.IO] Disconnected");
      setConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket.IO] Failed:", err.message);
      setConnected(false);
    });

    // =============================
    // CENTRAL PAYLOAD HANDLER
    // =============================
    const handlePayload = (data: any) => {
      if (!data) return;

      // Unified online condition
      const online =
        data.status === "online" ||
        data.isConnected === true ||
        data.deviceConnected === true ||
        (data.devices_online ?? data.devicesOnline ?? 0) > 0;

      lastUpdateRef.current = Date.now();

      const formatted: SensorData = {
        device_name: data.device_name || "Device",
        temperature: online ? data.temperature ?? null : currentData.temperature,
        humidity: online ? data.humidity ?? null : currentData.humidity,
        pressure: online ? data.pressure ?? null : currentData.pressure,
        timestamp: formatIndiaTime(data.timestamp || new Date()),
        status: online ? "online" : "offline",
        deviceConnected: online,
        isConnected: online,
        devicesOnline: data.devices_online ?? data.devicesOnline ?? 1,
        device_id: data.device_id,
      };

      setCurrentData(formatted);
      setIsDeviceConnected(online);

      if (online) {
        setChartData((prev) => [...prev.slice(-49), formatted]);
        setTableData((prev) => [formatted, ...prev.slice(0, 19)]);
      }

      // Reset offline timeout, only mark offline if NO updates for 12s
      if (offlineTimerRef.current !== null) {
        window.clearTimeout(offlineTimerRef.current);
      }

      offlineTimerRef.current = window.setTimeout(() => {
        const diff = Date.now() - lastUpdateRef.current;
        if (diff > 10000) {
          setIsDeviceConnected(false);
          setCurrentData((prev) => ({
            ...prev,
            status: "offline",
            temperature: null,
            humidity: null,
            pressure: null,
            timestamp: "--",
          }));
        }
      }, 12000);
    };

    // Socket events
    ["sensor_data", "device_data_update", "dashboard_update"].forEach((ev) =>
      socket.on(ev, handlePayload)
    );

    // Device manually marked offline
    socket.on("device_status", (data: any) => {
      if (!data) return;
      const diff = Date.now() - lastUpdateRef.current;
      if (data.status === "offline" && diff > 10000) {
        setIsDeviceConnected(false);
      }
    });

    // Global status from backend
    socket.on("mqtt_status", (data: any) => {
      if (!data) return;
      const diff = Date.now() - lastUpdateRef.current;
      if (data.status === "disconnected" && diff > 10000) {
        setIsDeviceConnected(false);
      }
    });

    // Cleanup
    return () => {
      socket.disconnect();
      if (offlineTimerRef.current !== null) {
        window.clearTimeout(offlineTimerRef.current);
      }
    };
  }, []); // Run only once

  // -------------------------------
  // 🕒 POLLING FALLBACK (LIVE PAGE ONLY)
  // -------------------------------
  useEffect(() => {
    if (page !== "live") return;

    const loadLatest = async () => {
      try {
        const res = await fetch(`${API}/api/data/latest`);
        if (!res.ok) return;
        const latest = await res.json();
        if (!latest) return;

        // Same unified logic
        const online =
          latest.status === "online" ||
          latest.isConnected === true ||
          (latest.devices_online ?? 0) > 0;

        if (!online) return; // do not mark offline here

        lastUpdateRef.current = Date.now();

        const formatted: SensorData = {
          ...latest,
          device_name: latest.device_name || "Device",
          temperature: latest.temperature ?? null,
          humidity: latest.humidity ?? null,
          pressure: latest.pressure ?? null,
          timestamp: formatIndiaTime(latest.timestamp || new Date()),
          status: "online",
          deviceConnected: true,
          isConnected: true,
          devicesOnline: latest.devices_online ?? 1,
        };

        setCurrentData(formatted);
        setChartData((prev) => [...prev.slice(-49), formatted]);
        setTableData((prev) => [formatted, ...prev.slice(0, 19)]);
        setIsDeviceConnected(true);
      } catch (err) {
        console.error("[useLiveData] Poll error:", err);
      }
    };

    loadLatest();
    const interval = window.setInterval(loadLatest, 5000);
    return () => window.clearInterval(interval);
  }, [page]);

  // -------------------------------
  // RETURN HOOK DATA
  // -------------------------------
  return {
    currentData,
    chartData,
    tableData,
    connected,
    isDeviceConnected,
  };
}
