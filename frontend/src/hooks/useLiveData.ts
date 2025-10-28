import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

interface SensorData {
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  timestamp: string;
}

export function useLiveData() {
  const [currentData, setCurrentData] = useState<SensorData>({
    temperature: 0,
    humidity: 0,
    pressure: 1013,
    timestamp: "--",
  });

  const [chartData, setChartData] = useState<SensorData[]>([]);
  const [tableData, setTableData] = useState<SensorData[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // 🔹 Load initial sensor data from backend REST API
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const res = await fetch(`${API}/api/data/latest`);
        const latest = await res.json();

        if (latest && typeof latest === "object" && latest.temperature !== undefined) {
          const formatted = {
            ...latest,
            timestamp: latest.timestamp || new Date().toLocaleTimeString(),
          };
          setCurrentData(formatted);
          setChartData([formatted]);
          setTableData([formatted]);
        } else {
          console.log("[useLiveData] No initial data found");
        }
      } catch (err) {
        console.error("[useLiveData] ❌ Failed to fetch initial data:", err);
      }
    };

    loadInitial();
  }, []);

  // 🔹 Connect to Flask-SocketIO for real-time dashboard updates
  useEffect(() => {
    socketRef.current = io(API, {
      transports: ["websocket", "polling"], // ✅ allow both for Docker compatibility
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current.on("connect", () => {
      console.log("[Socket.IO] ✅ Connected:", socketRef.current?.id);
    });

    socketRef.current.on("disconnect", (reason) => {
      console.warn("[Socket.IO] ⚠️ Disconnected:", reason);
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("[Socket.IO] ❌ Connection error:", err.message);
    });

    // 🔍 Debug log all incoming events
    socketRef.current.onAny((event, data) => {
      console.log(`[Socket.IO] Event: ${event}`, data);
    });

    // ✅ Listen for dashboard updates
    socketRef.current.on("dashboard_update", (data: SensorData) => {
      console.log("[Socket.IO] 📊 Dashboard update received:", data);

      // Handle cleared state (no connected device)
      if (
        !data ||
        Object.keys(data).length === 0 ||
        data.temperature === null ||
        data.temperature === undefined
      ) {
        console.log("[Socket.IO] 🧊 No device connected — clearing dashboard");
        setCurrentData({
          temperature: 0,
          humidity: 0,
          pressure: 1013,
          timestamp: "--",
        });
        setChartData([]);
        setTableData([]);
        return;
      }

      // Format and append new data
      const formatted = {
        ...data,
        timestamp: data.timestamp || new Date().toLocaleTimeString(),
      };

      setCurrentData(formatted);
      setChartData((prev) => [...prev.slice(-49), formatted]); // keep last 50
      setTableData((prev) => [formatted, ...prev.slice(0, 19)]); // keep last 20
    });

    // ✅ Cleanup socket on unmount
    return () => {
      socketRef.current?.disconnect();
      console.log("[Socket.IO] 🔌 Disconnected cleanly");
    };
  }, []);

  return { currentData, chartData, tableData };
}
