"use client";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useLiveData, SensorData } from "@/hooks/useLiveData";
import { Wifi, WifiOff } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

function formatIndiaTime(value?: string | number | Date) {
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

export default function LiveDataPage() {
  const { tableData, connected, isDeviceConnected, currentData } = useLiveData();
  const [lastUpdated, setLastUpdated] = useState<string>("--");
  const [localTable, setLocalTable] = useState<SensorData[]>([]);

  // ✅ Keep UI table synced with hook updates
  useEffect(() => {
    setLocalTable(tableData);
  }, [tableData]);

  // ✅ Update last updated time
  useEffect(() => {
    if (currentData?.timestamp && currentData.deviceConnected) {
      setLastUpdated(formatIndiaTime(currentData.timestamp));
    }
  }, [currentData]);

  // ✅ Fallback polling every 2 seconds (if socket data misses)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/data/latest`);
        const data = await res.json();
        if (!data) return;
        const formatted: SensorData = {
          device_name: data.device_name || currentData.device_name || "Unknown Device",
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

        // Append if timestamp is new
        setLocalTable((prev) => {
          if (prev.length === 0 || prev[0].timestamp !== formatted.timestamp) {
            return [formatted, ...prev.slice(0, 19)];
          }
          return prev;
        });
      } catch (err) {
        console.error("[LiveDataPage] polling error:", err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [currentData]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      online: "bg-metric-good text-foreground",
      offline: "bg-metric-critical text-foreground",
      warning: "bg-metric-warning text-foreground",
    };
    return (
      <Badge className={variants[status] || "bg-muted text-foreground"}>
        {status || "unknown"}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">📡 Live Device Data</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {connected && isDeviceConnected ? (
            <>
              <Wifi className="w-5 h-5 text-metric-good" />
              <span className="text-sm text-muted-foreground">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-metric-critical" />
              <span className="text-sm text-muted-foreground">Disconnected</span>
            </>
          )}
        </div>
      </div>

      <Card className="bg-gradient-card border-border">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h3 className="text-lg font-semibold">Recent Sensor Readings</h3>
          <span className="text-sm text-muted-foreground">
            Showing latest {localTable.length || 0} readings
          </span>
        </div>

        <div className="p-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Temperature</TableHead>
                <TableHead>Humidity</TableHead>
                <TableHead>Pressure</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localTable.length > 0 ? (
                localTable.map((entry: SensorData, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-sm">
                      {formatIndiaTime(entry.timestamp)}
                    </TableCell>
                    <TableCell>{entry.device_name || currentData.device_name || "—"}</TableCell>
                    <TableCell>
                      {entry.temperature !== undefined
                        ? `${entry.temperature}°C`
                        : "--"}
                    </TableCell>
                    <TableCell>
                      {entry.humidity !== undefined
                        ? `${entry.humidity}%`
                        : "--"}
                    </TableCell>
                    <TableCell>
                      {entry.pressure !== undefined
                        ? `${entry.pressure} hPa`
                        : "--"}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status || "offline")}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6">
                    <p className="text-muted-foreground">
                      {connected
                        ? "Waiting for live data..."
                        : "No active device connection."}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </DashboardLayout>
  );
}
