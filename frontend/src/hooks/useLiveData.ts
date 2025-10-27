import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

interface SensorData {
  temperature: number;
  humidity: number;
  pressure: number;
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

  // Load initial data from backend API
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
        }
      } catch (err) {
        console.error("[useLiveData] Failed to fetch initial data:", err);
      }
    };

    loadInitial();
  }, []);

  // Connect to Socket.IO backend
  useEffect(() => {
    socketRef.current = io(API, {
      transports: ["websocket"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current.on("connect", () => {
      console.log("[Socket.IO] Connected to backend:", socketRef.current?.id);
    });

    socketRef.current.on("disconnect", (reason) => {
      console.warn("[Socket.IO] Disconnected:", reason);
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("[Socket.IO] Connection error:", err.message);
    });

    socketRef.current.on("update_data", (data: SensorData) => {
      console.log("[Socket.IO] New MQTT data received:", data);

      const formatted = {
        ...data,
        timestamp: data.timestamp || new Date().toLocaleTimeString(),
      };

      setCurrentData(formatted);
      setChartData((prev) => [...prev.slice(-49), formatted]); // keep last 50 points
      setTableData((prev) => [formatted, ...prev.slice(0, 19)]); // keep last 20 records
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return { currentData, chartData, tableData };
}
