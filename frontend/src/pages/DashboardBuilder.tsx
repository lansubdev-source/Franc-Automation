"use client";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

/**
 * DashboardBuilder
 * - Role-aware widget list (shows only allowed widget types)
 * - Loads users / devices / sensors for selects (via /api)
 * - Lets user add widgets to a temporary list, preview, and save dashboard
 *
 * Assumptions:
 * - Backend endpoints:
 *    GET  /api/users            -> list users (each user has .id, .username, .role)
 *    GET  /api/devices          -> list devices (each device has .id, .name)
 *    GET  /api/sensors?device=  -> list sensors for device (optional). Fallback to static sensors (temp/hum/press)
 *    POST /api/dashboards       -> create dashboard (body contains name, description, owner_user_id, widgets)
 * - Auth token (if any) is stored in localStorage.user.token
 */

type Widget = {
  id: string;
  type: string;
  title?: string;
  deviceId?: number | null;
  sensorId?: number | null;
  config?: Record<string, any>;
  dateFrom?: string | null;
  dateTo?: string | null;
};

const DashboardBuilder: React.FC = () => {
  const navigate = useNavigate();

  const [role, setRole] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  // assignUserId is optional (unrequired)
  const [assignUserId, setAssignUserId] = useState<number | "">("");
  const [assignRole, setAssignRole] = useState<string>(""); // new Role dropdown (filters users if needed)

  const [widgetType, setWidgetType] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [deviceId, setDeviceId] = useState<number | "">("");
  const [sensorId, setSensorId] = useState<number | "">("");
  const [tableColumns, setTableColumns] = useState<string>("");
  const [onPayload, setOnPayload] = useState<string>("ON");
  const [offPayload, setOffPayload] = useState<string>("OFF");
  const [mqttTopic, setMqttTopic] = useState<string>("");
  const [buttonLabel, setButtonLabel] = useState<string>("Toggle");
  // date range for widget preview (per-widget will also have its own captured range)
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [users, setUsers] = useState<Array<any>>([]);
  const [devices, setDevices] = useState<Array<any>>([]);
  const [sensors, setSensors] = useState<Array<any>>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [message, setMessage] = useState<string>("");

  // read role from localStorage user object (front-end logged-in user)
  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setRole(parsed.role || "");
      } catch {
        setRole("");
      }
    }
  }, []);

  // helper: token and auth helpers
  function getToken() {
    const raw = localStorage.getItem("user");
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw);
      return parsed.token || "";
    } catch {
      return "";
    }
  }
  function authGet(token: string | null) {
    return {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    } as any;
  }
  function authPostOptions(body: any) {
    const token = getToken();
    return {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    } as RequestInit;
  }

  // fetch users / devices initially
  useEffect(() => {
    const token = getToken();

    fetch("/api/users", authGet(token))
      .then((r) => r.json())
      .then((data) => {
        // some APIs return {status, users: []}, some return array directly.
        if (Array.isArray(data)) setUsers(data);
        else if (data?.users) setUsers(data.users);
        else if (data?.status === "success" && Array.isArray(data?.users)) setUsers(data.users);
      })
      .catch(() => {
        // ignore
      });

    fetch("/api/devices", authGet(token))
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDevices(data);
        else if (data?.devices) setDevices(data.devices);
        else if (data?.status === "success" && Array.isArray(data?.devices)) setDevices(data.devices);
      })
      .catch(() => {
        // ignore
      });
  }, []);

  // compute roles from users (unique)
  const roles = Array.from(new Set(users.map((u) => (u.role || (u.roles?.[0]?.name || "user"))))).sort();

  // fetch sensors when device changes
  useEffect(() => {
    if (!deviceId) {
      // show static sensors if no device chosen
      setSensors([
        { id: "temperature", topic: "temperature" },
        { id: "humidity", topic: "humidity" },
        { id: "pressure", topic: "pressure" },
      ]);
      return;
    }

    // try call backend sensors endpoint for that device
    const token = getToken();
    // backend might expect device param name device or device_id — try both patterns gracefully
    fetch(`/api/sensors?device=${deviceId}`, authGet(token))
      .then((r) => r.json())
      .then((data) => {
        // backend responses: {status, sensors: []} or array
        if (Array.isArray(data)) {
          // array of sensors
          setSensors(data);
        } else if (data?.sensors && Array.isArray(data.sensors) && data.sensors.length > 0) {
          setSensors(data.sensors);
        } else if (data?.status === "success" && Array.isArray(data?.sensors) && data.sensors.length > 0) {
          setSensors(data.sensors);
        } else {
          // fallback to static
          setSensors([
            { id: "temperature", topic: "temperature" },
            { id: "humidity", topic: "humidity" },
            { id: "pressure", topic: "pressure" },
          ]);
        }
      })
      .catch(() => {
        // fallback static values
        setSensors([
          { id: "temperature", topic: "temperature" },
          { id: "humidity", topic: "humidity" },
          { id: "pressure", topic: "pressure" },
        ]);
      });
  }, [deviceId]);

  // allowed widgets per role (frontend mirror of backend rules)
  const allowedWidgetsForRole = (r: string) => {
    switch (r) {
      case "superadmin":
      case "admin":
        return [
          { value: "line", label: "Line Chart" },
          { value: "gauge", label: "Gauge" },
          { value: "pressure_chart", label: "Pressure Chart" },
          { value: "temperature_chart", label: "Temperature Chart" },
          { value: "humidity_chart", label: "Humidity Chart" },
          { value: "table", label: "Table" },
          { value: "onoff", label: "On/Off Button" },
        ];
      case "user1":
        return [{ value: "temperature_chart", label: "Temperature Chart" }];
      case "user2":
        return [{ value: "humidity_chart", label: "Humidity Chart" }];
      case "user3":
        return [{ value: "pressure_chart", label: "Pressure Chart" }];
      case "user4":
        return [
          { value: "temperature_chart", label: "Temperature Chart" },
          { value: "pressure_chart", label: "Pressure Chart" },
        ];
      default:
        return []; // user5..user10 fallback
    }
  };

  const allowedWidgets = allowedWidgetsForRole(role);

  // add widget to list (client-side)
  const addWidget = (e?: React.FormEvent) => {
    e?.preventDefault();
    setMessage("");

    if (!widgetType) {
      setMessage("Select a widget type.");
      return;
    }

    // validate that the chosen widgetType is allowed for the role
    if (!allowedWidgets.some((w) => w.value === widgetType)) {
      setMessage("You are not permitted to add this widget type.");
      return;
    }

    // devices/sensor required for most widgets (onoff can allow missing sensor)
    const needsDeviceSensor = [
      "line",
      "gauge",
      "pressure_chart",
      "temperature_chart",
      "humidity_chart",
      "table",
      "onoff",
    ];
    if (needsDeviceSensor.includes(widgetType)) {
      if (!deviceId) {
        setMessage("Please select a device.");
        return;
      }
      if (!sensorId && widgetType !== "onoff") {
        setMessage("Please select a sensor.");
        return;
      }
    }

    // build widget config
    const wid: Widget = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: widgetType,
      title: title || undefined,
      deviceId: deviceId === "" ? null : Number(deviceId),
      sensorId: sensorId === "" ? null : sensorId, // could be string (topic) or numeric id depending on backend
      config: {},
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    };

    if (widgetType === "table") {
      wid.config = {
        columns: (tableColumns || "timestamp,value").split(",").map((c) => c.trim()),
      };
    }
    if (widgetType === "onoff") {
      wid.config = { mqttTopic, onPayload, offPayload, buttonLabel };
    }

    setWidgets((prev) => [...prev, wid]);

    // reset widget fields
    setWidgetType("");
    setTitle("");
    setDeviceId("");
    setSensorId("");
    setTableColumns("");
    setMqttTopic("");
    setOnPayload("ON");
    setOffPayload("OFF");
    setButtonLabel("Toggle");
    setDateFrom("");
    setDateTo("");
  };

  const removeWidget = (id: string) => setWidgets((w) => w.filter((x) => x.id !== id));

  // Save dashboard to backend
  const saveDashboard = async () => {
    setMessage("");
    if (!name) {
      setMessage("Dashboard name required.");
      return;
    }

    // assignUserId optional — if blank use current user (read from localStorage)
let ownerId: number | "" | null = assignUserId;

// FIXED: safe check
if (ownerId === "" || ownerId === null || ownerId === undefined) {
  const raw = localStorage.getItem("user");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);

      ownerId =
        parsed?.user_id ||
        parsed?.id ||
        parsed?.userId ||
        parsed?.user?.id ||
        null;

    } catch {
      ownerId = null;
    }
  }
}

    // if still falsy, set to undefined and backend should fallback to creator
    const payload = {
      name,
      description,
      owner_user_id: ownerId || undefined,
      widgets: widgets.map((w) => ({
        type: w.type,
        title: w.title,
        device_id: w.deviceId,
        sensor_id: w.sensorId,
        config: w.config || {},
        date_from: w.dateFrom || null,
        date_to: w.dateTo || null,
      })),
    };

    try {
      const res = await fetch("/api/dashboards", authPostOptions(payload));
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "Failed to save dashboard");
        return;
      }
      setMessage("Dashboard saved successfully.");
      // clear or navigate to dashboards list
      setTimeout(() => {
        navigate("/dashboards");
      }, 500);
    } catch (err) {
      setMessage("Server error while saving dashboard.");
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 text-gray-200 bg-gray-900 min-h-screen">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold flex items-center mb-2">
            <i className="bi bi-layout-text-window-reverse text-blue-500 mr-2"></i>{" "}
            Dashboard Builder
          </h2>
          <p className="text-gray-400">
            Create and customize IoT dashboards with drag-and-drop widgets. Assign
            dashboards to users and devices for real-time monitoring.
          </p>
        </div>

        {/* Dashboard Info Card */}
        <div className="bg-gray-800 shadow-md rounded-lg mb-6 border border-gray-700">
          <div className="border-b border-gray-700 px-4 py-3">
            <span className="font-semibold text-gray-100 flex items-center">
              <i className="bi bi-info-circle text-blue-400 mr-2"></i> Dashboard
              Info
            </span>
          </div>
          <div className="p-4">
            <form className="grid md:grid-cols-3 gap-4" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  <i className="bi bi-fonts mr-1"></i> Dashboard Name{" "}
                  <span className="text-red-500">*</span>
                </label>
                
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  placeholder="e.g. Factory Floor"
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  <i className="bi bi-card-text mr-1"></i> Description
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  type="text"
                  placeholder="Short description"
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  <i className="bi bi-person mr-1"></i> Assign to User{" "}
                  <span className="text-gray-400 text-xs ml-1">(optional)</span>
                </label>

                {/* Role Dropdown - derived from users */}
                <div className="mb-2">
                  <select
                    value={assignRole}
                    onChange={(e) => setAssignRole(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Filter by role (optional)</option>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select user (optional)</option>
                  {users
                    .filter((u) => {
                      if (!assignRole) return true;
                      const r = u.role || (u.roles?.[0]?.name || "user");
                      return r === assignRole;
                    })
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.username} {u.role ? `(${u.role})` : u.roles?.length ? `(${u.roles.map((r:any)=>r.name).join(",")})` : ""}
                      </option>
                    ))}
                </select>
              </div>
            </form>
          </div>
        </div>

        {/* Add Widget Card */}
        <div className="bg-gray-800 shadow-md rounded-lg mb-6 border border-gray-700">
          <div className="border-b border-gray-700 px-4 py-3">
            <span className="font-semibold text-gray-100 flex items-center">
              <i className="bi bi-plus-circle text-blue-400 mr-2"></i> Add Widget
            </span>
          </div>
          <div className="p-4">
            <form className="grid md:grid-cols-4 gap-4" onSubmit={addWidget}>
              {/* Widget Type */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  <i className="bi bi-bar-chart mr-1"></i> Chart Type{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={widgetType}
                  onChange={(e) => setWidgetType(e.target.value)}
                >
                  <option value="">Select type</option>
                  {allowedWidgets.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
                {allowedWidgets.length === 0 && (
                  <p className="text-red-400 text-sm mt-1">You do not have permission to add widgets.</p>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  <i className="bi bi-type mr-1"></i> Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  type="text"
                  placeholder="Widget title (optional)"
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Device */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  <i className="bi bi-cpu mr-1"></i> Device{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">Select device</option>
                  {devices.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sensor */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  <i className="bi bi-activity mr-1"></i> Sensor{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={sensorId}
                  onChange={(e) => {
                  const value = e.target.value;
                  setAssignUserId(value === "" ? "" : Number(value));
                }}
                >
                  <option value="">Select sensor</option>
                  {sensors.map((s: any) => (
                    <option key={s.id ?? s.topic} value={s.id ?? s.topic}>
                      {s.topic ?? s.name ?? s.id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date range selector (applies to preview and saved widget metadata) */}
              <div className="md:col-span-4 grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">From (optional)</label>
                  <input
                    type="datetime-local"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">To (optional)</label>
                  <input
                    type="datetime-local"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100"
                  />
                </div>
              </div>

              {/* Conditional Config Sections */}
              {widgetType === "table" && (
                <div className="md:col-span-4">
                  <label className="block text-sm font-semibold mb-1">
                    <i className="bi bi-table mr-1"></i> Table Columns
                  </label>
                  <input
                    value={tableColumns}
                    onChange={(e) => setTableColumns(e.target.value)}
                    type="text"
                    placeholder="e.g. timestamp,value"
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {widgetType === "onoff" && (
                <div className="md:col-span-4 grid md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">MQTT Topic</label>
                    <input
                      value={mqttTopic}
                      onChange={(e) => setMqttTopic(e.target.value)}
                      type="text"
                      placeholder="/device/relay"
                      className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">On Payload</label>
                    <input
                      value={onPayload}
                      onChange={(e) => setOnPayload(e.target.value)}
                      type="text"
                      className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Off Payload</label>
                    <input
                      value={offPayload}
                      onChange={(e) => setOffPayload(e.target.value)}
                      type="text"
                      className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Button Label</label>
                    <input
                      value={buttonLabel}
                      onChange={(e) => setButtonLabel(e.target.value)}
                      type="text"
                      className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100"
                    />
                  </div>
                </div>
              )}

              <div className="md:col-span-4 flex items-center gap-3 mt-3">
                <button
                  onClick={addWidget}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                >
                  <i className="bi bi-plus-lg mr-1"></i> Add Widget
                </button>
                <button
                  type="button"
                  onClick={() => {
                    /* preview is automatic below, does nothing here */
                  }}
                  className="border border-gray-500 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-md"
                >
                  <i className="bi bi-eye mr-1"></i> Preview Widget
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Widgets Preview */}
        <div className="mb-6">
          <h5 className="font-semibold mb-3 flex items-center text-gray-100">
            <i className="bi bi-grid-3x3-gap mr-2"></i> Dashboard Widgets
          </h5>
          <div className="grid md:grid-cols-3 gap-4">
            {widgets.length === 0 ? (
              <div className="border-2 border-dashed border-gray-700 rounded-lg h-32 flex items-center justify-center text-gray-500">
                No widgets added yet
              </div>
            ) : (
              widgets.map((w) => (
                <div key={w.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm text-gray-300 font-semibold">
                        {w.title || `Widget: ${w.type}`}
                      </div>
                      <div className="text-xs text-gray-400">{w.type}</div>
                      <div className="text-xs text-gray-400">
                        Device: {w.deviceId ?? "—"} Sensor: {w.sensorId ?? "—"}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {w.dateFrom ? `From: ${w.dateFrom}` : "From: —"}{" "}
                        {w.dateTo ? ` To: ${w.dateTo}` : ""}
                      </div>
                    </div>
                    <div>
                      <button
                        onClick={() => removeWidget(w.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Minimal "preview" box — styled like cards in the dashboard */}
                  <div className="mt-3 h-24 bg-gray-900 rounded-md border border-gray-800 flex flex-col p-3 justify-center text-gray-500">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-gray-200">
                        {w.type.includes("chart") ? "Chart preview" : w.type === "table" ? "Table preview" : "Control preview"}
                      </div>
                      <div className="text-xs text-gray-400">{w.config?.columns ? (w.config.columns || []).join(", ") : ""}</div>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      {w.type.includes("chart") ? (
                        `Previewing ${w.type} for sensor ${w.sensorId ?? "—"}`
                      ) : w.type === "table" ? (
                        `Columns: ${(w.config?.columns || []).join(", ")}`
                      ) : w.type === "onoff" ? (
                        `Topic: ${w.config?.mqttTopic || mqttTopic}`
                      ) : (
                        "Preview"
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end items-center gap-4">
          {message && <div className="text-sm text-yellow-300">{message}</div>}
          <button
            onClick={saveDashboard}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-lg font-semibold"
          >
            <i className="bi bi-save mr-1"></i> Save Dashboard
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardBuilder;
