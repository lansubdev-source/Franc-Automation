"use client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Wifi,
  WifiOff,
  MoreVertical,
  Edit,
  Trash2,
  PlugZap,
  Plug,
  Lock,
} from "lucide-react";
import { useDevicesLive } from "@/hooks/useDevicesLive";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/api";
import { io } from "socket.io-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

// ------------------------------------------------------
// Initialize Socket.IO client
// ------------------------------------------------------
const socket = io(API, { transports: ["websocket", "polling"] });

export default function Devices() {
  const { devices, loading, reload: loadDevices } = useDevicesLive();
  const [deviceData, setDeviceData] = useState<Record<number, any>>({});
  const [formData, setFormData] = useState({
    name: "",
    protocol: "mqtt://",
    host: "",
    port: 1883,
    clientId: "",
    username: "",
    password: "",
    mqttVersion: "3.1.1",
    keepAlive: 60,
    autoReconnect: true,
    reconnectPeriod: 5000,
    enableTLS: false,
  });
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [editedName, setEditedName] = useState("");

  // ------------------------------------------------------
  // Debounced reload
  // ------------------------------------------------------
  const debouncedReload = useCallback(() => {
    const timeout = setTimeout(() => loadDevices(), 500);
    return () => clearTimeout(timeout);
  }, [loadDevices]);

  // ------------------------------------------------------
  // 🧠 Live updates via Socket.IO
  // ------------------------------------------------------
  useEffect(() => {
    const handleSensorData = (data: any) => {
      setDeviceData((prev) => ({
        ...prev,
        [data.device_id]: {
          ...prev[data.device_id],
          // ✅ Preserve existing name if MQTT doesn't send one
          device_name:
            data.device_name ||
            prev[data.device_id]?.device_name ||
            "Unknown Device",
          temperature: data.temperature,
          humidity: data.humidity,
          pressure: data.pressure,
          lastSeen: data.timestamp,
          status: data.status || "online",
        },
      }));
    };

    const handleDeviceStatus = (data: any) => {
      setDeviceData((prev) => ({
        ...prev,
        [data.device_id]: {
          ...prev[data.device_id],
          status: data.status,
          lastSeen: data.last_seen || new Date().toISOString(),
        },
      }));
      debouncedReload();
    };

    socket.on("sensor_data", handleSensorData);
    socket.on("device_status", handleDeviceStatus);
    socket.on("device_data_update", handleSensorData);

    return () => {
      socket.off("sensor_data", handleSensorData);
      socket.off("device_status", handleDeviceStatus);
      socket.off("device_data_update", handleSensorData);
    };
  }, [debouncedReload]);

  // ------------------------------------------------------
  // 🔁 Polling every 2 seconds (for reliability)
  // ------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/data/latest`);
        const data = await res.json();
        if (!data || !data.device_id) return;

        setDeviceData((prev) => ({
          ...prev,
          [data.device_id]: {
            ...prev[data.device_id],
            // ✅ Preserve previous name if missing
            device_name:
              data.device_name ||
              prev[data.device_id]?.device_name ||
              "Unknown Device",
            temperature: data.temperature,
            humidity: data.humidity,
            pressure: data.pressure,
            lastSeen: data.timestamp,
            status: data.status || "online",
          },
        }));
      } catch (err) {
        console.error("[Devices] polling error:", err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ------------------------------------------------------
  // Form handlers
  // ------------------------------------------------------
  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await api.addDevice(formData);
      alert("✅ Device added successfully!");
      setFormData({
        name: "",
        protocol: "mqtt://",
        host: "",
        port: 1883,
        clientId: "",
        username: "",
        password: "",
        mqttVersion: "3.1.1",
        keepAlive: 60,
        autoReconnect: true,
        reconnectPeriod: 5000,
        enableTLS: false,
      });
      loadDevices();
    } catch (error) {
      console.error("[ADD DEVICE ERROR]", error);
      alert("❌ Error adding device");
    }
  };

  // ------------------------------------------------------
  // Device actions
  // ------------------------------------------------------
  const handleDelete = async (deviceId: number) => {
    if (!confirm("Are you sure you want to delete this device?")) return;
    try {
      await api.deleteDevice(deviceId);
      alert("🗑️ Device deleted successfully!");
      loadDevices();
    } catch (error) {
      console.error("[DELETE ERROR]", error);
      alert("❌ Failed to delete device");
    }
  };

  const handleEdit = (device: any) => {
    setEditingDevice(device);
    setEditedName(device.name);
  };

  const handleSaveEdit = async () => {
    if (!editedName.trim()) {
      alert("Device name cannot be empty!");
      return;
    }
    try {
      await api.updateDevice(editingDevice.id, { name: editedName });
      alert("✅ Device updated successfully!");
      setEditingDevice(null);
      loadDevices();
    } catch (error) {
      console.error("❌ Edit failed:", error);
      alert("Error updating device");
    }
  };

  const handleToggleConnection = async (device: any) => {
    try {
      const endpoint = device.is_connected
        ? `/api/devices/${device.id}/disconnect`
        : `/api/devices/${device.id}/connect`;
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(`🔌 ${data.message}`);
        loadDevices();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      console.error("❌ Toggle connection error:", error);
      alert("Error connecting/disconnecting device");
    }
  };

  // ------------------------------------------------------
  // Filter out simulated devices
  // ------------------------------------------------------
  const realDevices = devices.filter((d) => !d.simulated);

  // ------------------------------------------------------
  // UI Rendering
  // ------------------------------------------------------
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-3xl font-bold mb-2">Devices</h1>
        <p className="text-muted-foreground mb-6">
          Manage your MQTT devices and connections
        </p>

        {/* -------------------- ADD DEVICE FORM -------------------- */}
        <div className="max-w-2xl bg-gradient-card shadow-lg rounded-xl p-6 border border-border mb-10">
          <h2 className="text-xl font-semibold mb-4">➕ Add Device</h2>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground">
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full bg-background border-border border rounded-lg p-2 text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground">
                  Protocol *
                </label>
                <select
                  name="protocol"
                  value={formData.protocol}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-lg p-2"
                >
                  <option value="mqtt://">mqtt://</option>
                  <option value="mqtts://">mqtts:// (Secure)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground">
                  MQTT Version
                </label>
                <select
                  name="mqttVersion"
                  value={formData.mqttVersion}
                  onChange={handleChange}
                  className="w-full bg-background border border-border rounded-lg p-2"
                >
                  <option value="3.1">3.1</option>
                  <option value="3.1.1">3.1.1</option>
                  <option value="5.0">5.0</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground">
                  Host *
                </label>
                <input
                  type="text"
                  name="host"
                  placeholder="broker.example.com"
                  value={formData.host}
                  onChange={handleChange}
                  required
                  className="w-full bg-background border-border border rounded-lg p-2 text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground">
                  Port *
                </label>
                <input
                  type="number"
                  name="port"
                  value={formData.port}
                  onChange={handleChange}
                  className="w-full bg-background border-border border rounded-lg p-2 text-foreground"
                />
              </div>
            </div>

            {/* TLS Switch */}
            <div className="flex items-center gap-3 mt-1">
              <Switch
                id="enableTLS"
                checked={formData.enableTLS}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enableTLS: checked })
                }
              />
              <Label
                htmlFor="enableTLS"
                className="text-sm text-muted-foreground flex items-center gap-1"
              >
                <Lock className="w-4 h-4" /> Enable TLS / SSL Secure Connection
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full bg-background border-border border rounded-lg p-2 text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-background border-border border rounded-lg p-2 text-foreground"
                />
              </div>
            </div>

            <button
              type="submit"
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Save Device
            </button>
          </form>
        </div>

        {/* -------------------- DEVICE CARDS -------------------- */}
        {loading ? (
          <p className="text-center text-muted-foreground mb-8">
            Loading devices...
          </p>
        ) : realDevices.length === 0 ? (
          <div className="bg-gradient-card p-8 rounded-xl border border-border text-center mb-8">
            <WifiOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Devices Found</h3>
            <p className="text-muted-foreground">
              Add your first MQTT device using the form above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {realDevices.map((device) => {
              const live = deviceData[device.id] || {};
              const isOnline =
                (live.status || device.status) === "online" ||
                device.is_connected;

              return (
                <div
                  key={device.id}
                  className="bg-gradient-card p-4 rounded-xl border border-border relative"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {isOnline ? (
                        <Wifi className="w-5 h-5 text-green-500" />
                      ) : (
                        <WifiOff className="w-5 h-5 text-red-500" />
                      )}
                      <h3 className="font-medium">
                        {live.device_name || device.name}
                      </h3>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded hover:bg-muted transition">
                          <MoreVertical className="w-5 h-5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(device)}>
                          <Edit className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleToggleConnection(device)}
                        >
                          {isOnline ? (
                            <>
                              <Plug className="w-4 h-4 mr-2" /> Disconnect
                            </>
                          ) : (
                            <>
                              <PlugZap className="w-4 h-4 mr-2" /> Connect
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(device.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Online/Offline indicator */}
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isOnline
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {isOnline ? "Online" : "Offline"}
                  </span>

                  {/* Real-time Sensor Data */}
                  <div className="mt-3 text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Temperature:</span>
                      <span className="font-medium text-foreground">
                        {live.temperature !== undefined
                          ? `${live.temperature}°C`
                          : "--"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Humidity:</span>
                      <span className="font-medium text-foreground">
                        {live.humidity !== undefined
                          ? `${live.humidity}%`
                          : "--"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Pressure:</span>
                      <span className="font-medium text-foreground">
                        {live.pressure !== undefined
                          ? `${live.pressure} hPa`
                          : "--"}
                      </span>
                    </div>
                    <p className="pt-2 text-xs">
                      Last seen:{" "}
                      {live.lastSeen
                        ? new Date(live.lastSeen).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })
                        : "Never"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
