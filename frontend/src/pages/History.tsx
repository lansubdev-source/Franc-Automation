"use client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:5000"; // ← FIXED, NO ENV

interface SensorRecord {
  id: number;
  device_id: string | number;
  temperature: number;
  humidity: number;
  pressure: number;
  timestamp: string;
}

interface HistoryGrouped {
  [date: string]: SensorRecord[];
}

export default function History() {
  const [history, setHistory] = useState<HistoryGrouped>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =============================
  // Fetch grouped history
  // =============================
  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/history`);
      const json = await res.json();

      if (json?.status === "success" && json?.data) {
        setHistory(json.data);
      } else {
        setError("Invalid response format");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <DashboardLayout>
      <div className="p-6 bg-[#0d1117] text-white min-h-screen">
        <h1 className="text-2xl font-bold mb-6">History (Last 7 Days)</h1>

        {loading && <p>Loading history...</p>}
        {error && <p className="text-red-400">{error}</p>}

        <div className="space-y-6 mt-6">
          {Object.keys(history).map((date) => (
            <div key={date} className="bg-[#161b22] p-5 rounded-xl">
              <h2 className="text-lg font-semibold text-blue-400 mb-3">
                {date}
              </h2>

              {/* Download buttons per day */}
              <div className="flex gap-3">
                <button
                  onClick={() =>
                    window.open(`${API_URL}/api/history/export/csv?date=${date}`)
                  }
                  className="px-4 py-2 bg-green-600 rounded-lg"
                >
                  Download CSV
                </button>

                <button
                  onClick={() =>
                    window.open(`${API_URL}/api/history/export/json?date=${date}`)
                  }
                  className="px-4 py-2 bg-blue-600 rounded-lg"
                >
                  Download JSON
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
