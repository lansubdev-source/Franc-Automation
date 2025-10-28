"use client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  Activity,
  Wifi,
  WifiOff,
  MoreVertical,
  Edit,
  Trash2,
  X,
  Save,
} from "lucide-react";
import { useDevicesLive } from "@/hooks/useDevicesLive";
import { useState } from "react";
import { api } from "@/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Devices() {
  const { devices, loading, reload: loadDevices } = useDevicesLive();

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
  });

  // For edit modal
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [editedName, setEditedName] = useState("");

  // Handle form input change
  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // Handle form submit
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      const json = await api.addDevice(formData);
      alert("✅ Device added successfully!");
      console.log("%c[DEVICE ADDED]", "color:#00c853", json);

      // Reset form
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
      });

      loadDevices();
    } catch (error) {
      console.error("%c[ADD DEVICE ERROR]", "color:red", error);
      alert("❌ Error adding device");
    }
  };

  // Handle delete
  const handleDelete = async (deviceId: string) => {
    if (!confirm("Are you sure you want to delete this device?")) return;
    try {
      await api.deleteDevice(deviceId);
      alert("🗑️ Device deleted successfully!");
      loadDevices();
    } catch (error) {
      console.error("%c[DELETE ERROR]", "color:red", error);
      alert("❌ Failed to delete device");
    }
  };

  // Handle edit modal open
  const handleEdit = (device: any) => {
    setEditingDevice(device);
    setEditedName(device.name);
  };

  // Handle edit save
  const handleSaveEdit = async () => {
    if (!editedName.trim()) {
      alert("Device name cannot be empty!");
      return;
    }

    try {
      await fetch(`/api/devices/${editingDevice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editedName }),
      });

      alert("✅ Device updated successfully!");
      setEditingDevice(null);
      loadDevices();
    } catch (error) {
      console.error("❌ Edit failed:", error);
      alert("Error updating device");
    }
  };

  return (
    <DashboardLayout>
      <div>
        <h1 className="text-3xl font-bold mb-2">Devices</h1>
        <p className="text-muted-foreground mb-6">
          Manage your MQTT devices and connections
        </p>

        {/* Device Cards */}
        {loading ? (
          <p className="text-center text-muted-foreground mb-8">
            Loading devices...
          </p>
        ) : devices.length === 0 ? (
          <div className="bg-gradient-card p-8 rounded-xl border border-border text-center mb-8">
            <WifiOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Devices Found</h3>
            <p className="text-muted-foreground">
              Add your first MQTT device using the form below.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {devices.map((device) => (
              <div
                key={device.id || device.name}
                className="bg-gradient-card p-4 rounded-xl border border-border relative"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {device.status === "online" ? (
                      <Wifi className="w-5 h-5 text-primary" />
                    ) : device.status === "warning" ? (
                      <Activity className="w-5 h-5 text-metric-warning" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-metric-critical" />
                    )}
                    <h3 className="font-medium">{device.name}</h3>
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
                        className="text-destructive"
                        onClick={() => handleDelete(device.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-1 mb-2">
                  <div
                    className={`w-2 h-2 rounded-full animate-pulse ${
                      device.status === "online"
                        ? "bg-metric-good"
                        : device.status === "warning"
                        ? "bg-metric-warning"
                        : "bg-metric-critical"
                    }`}
                  ></div>
                  <span className="text-sm text-muted-foreground capitalize">
                    {device.status}
                  </span>
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Temperature:</span>
                    <span className="font-medium text-foreground">
                      {device.temperature ?? "--"}°C
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Humidity:</span>
                    <span className="font-medium text-foreground">
                      {device.humidity ?? "--"}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pressure:</span>
                    <span className="font-medium text-foreground">
                      {device.pressure ?? "--"} hPa
                    </span>
                  </div>
                  <p className="pt-2 text-xs">
                    Last seen:{" "}
                    {device.lastSeen
                      ? new Date(device.lastSeen).toLocaleString()
                      : device.updatedAt || "Never"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Device Form */}
        <div className="max-w-2xl bg-gradient-card shadow-lg rounded-xl p-6 border border-border">
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
                className="w-full bg-background border-border border rounded-lg p-2 text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
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
                  className="w-full bg-background border-border border rounded-lg p-2 text-foreground"
                >
                  <option value="mqtt://">mqtt://</option>
                  <option value="mqtts://">mqtts://</option>
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
                  className="w-full bg-background border-border border rounded-lg p-2 text-foreground"
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
                  className="w-full bg-background border-border border rounded-lg p-2 text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground">
                  Client ID
                </label>
                <input
                  type="text"
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleChange}
                  className="w-full bg-background border-border border rounded-lg p-2 text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground">
                  Keep Alive (s)
                </label>
                <input
                  type="number"
                  name="keepAlive"
                  value={formData.keepAlive}
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

        {/* Edit Modal */}
        {editingDevice && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-xl p-6 w-96 shadow-xl">
              <h2 className="text-lg font-semibold mb-4">
                Editing: {editingDevice.name}
              </h2>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full border border-border rounded-lg p-2 mb-4 bg-background text-foreground"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setEditingDevice(null)}
                  className="bg-muted px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary/90"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
