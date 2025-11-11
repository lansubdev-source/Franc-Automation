import React, { useEffect, useState } from "react";
import { saveAs } from "file-saver";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

interface SensorRecord {
  id: number;
  device_id: number;
  temperature: number;
  humidity: number;
  pressure: number;
  timestamp: string;
}

export default function History() {
  const [history, setHistory] = useState<Record<string, SensorRecord[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/history`);
        const json = await res.json();
        if (json.status === "success" && json.data) {
          setHistory(json.data);
        }
      } catch (err) {
        console.error("Error fetching history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const downloadDay = async (date: string, format: "json" | "csv") => {
    const res = await fetch(`${API_URL}/history/download/${date}?format=${format}`);
    const blob = await res.blob();
    saveAs(blob, `${date}_sensors.${format}`);
  };

  const downloadAll = async (format: "json" | "csv") => {
    const res = await fetch(`${API_URL}/history/download/last7.zip?format=${format}`);
    if (!res.ok) return console.error("ZIP download failed");
    const blob = await res.blob();
    saveAs(blob, `last_7_days_${format}.zip`);
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen bg-black text-gray-400">
        Loading history...
      </div>
    );

  const dates = Object.keys(history).sort((a, b) => (a < b ? 1 : -1));

  return (
    <DashboardLayout>
    <div className="bg-black text-gray-200 min-h-screen p-10">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-4 md:mb-0">
          📁 Sensor History Archive
        </h1>
        <div className="flex gap-3">
          <button
            onClick={() => downloadAll("json")}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
          >
            ⬇ Download All (JSON ZIP)
          </button>
          <button
            onClick={() => downloadAll("csv")}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg"
          >
            ⬇ Download All (CSV ZIP)
          </button>
        </div>
      </div>

      {dates.length === 0 ? (
        <p className="text-center text-gray-400">No data available.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {dates.map((date) => (
            <div
              key={date}
              className="bg-gray-900 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-all duration-200"
            >
              <h2 className="text-xl font-semibold mb-4 text-center text-white">{date}</h2>
              <p className="text-center text-gray-400 mb-6">
                {history[date].length} records
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => downloadDay(date, "json")}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
                >
                  Download JSON
                </button>
                <button
                  onClick={() => downloadDay(date, "csv")}
                  className="bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg"
                >
                  Download CSV
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
