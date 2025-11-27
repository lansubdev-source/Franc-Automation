"use client";
import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

/**
 * DashboardBuilder
 * - Role-aware widget list (shows only allowed widget types)
 * - Loads users / devices / sensors for selects (via /api)
 * - Lets user add widgets to a temporary list, preview, and save dashboard
 *
 * Notes:
 * - Sensor dropdown shows fixed sensor types (temperature, humidity, pressure)
 *   as requested. Backend sensors (if present) are still fetched but the UI
 *   prefers the fixed sensor-type selection for typical IoT numeric widgets.
 * - Role dropdown filters the "Assign to User" dropdown to only show users
 *   for the chosen role.
 *
 * Backend endpoints assumed:
 * - GET  /api/users            -> list users (id, username, roles[])
 * - GET  /api/devices          -> list devices (id, name)
 * - GET  /api/sensors?device=  -> optional; we still call it but UI uses fixed types
 * - POST /api/dashboards       -> create dashboard (payload below)
 *
 * Dashboard POST payload example:
 * {
 *   name,
 *   description,
 *   owner_user_id,
 *   widgets: [{ type, title, device_id, sensor, config }]
 * }
 */

type Widget = {
  id: string;
  type: string;
  title?: string;
  deviceId?: number | null;
  sensor?: string | number | null; // string for fixed sensor types (temperature...), number for backend sensor id
  config?: Record<string, any>;
};

const DashboardBuilder: React.FC = () => {
  const [role, setRole] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [assignUserId, setAssignUserId] = useState<number | "">("");
  const [widgetType, setWidgetType] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [deviceId, setDeviceId] = useState<number | "">("");
  const [sensor, setSensor] = useState<string | number | "">(""); // can be "temperature" or sensor id
  const [tableColumns, setTableColumns] = useState<string>("");
  const [onPayload, setOnPayload] = useState<string>("ON");
  const [offPayload, setOffPayload] = useState<string>("OFF");
  const [mqttTopic, setMqttTopic] = useState<string>("");
  const [buttonLabel, setButtonLabel] = useState<string>("Toggle");

  const [users, setUsers] = useState<Array<any>>([]);
  const [devices, setDevices] = useState<Array<any>>([]);
  const [backendSensors, setBackendSensors] = useState<Array<any>>([]); // sensors returned by backend per device
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [message, setMessage] = useState<string>("");

  // Fixed sensor type options requested (human label + internal value)
  const FIXED_SENSOR_TYPES = [
    { value: "temperature", label: "Temperature" },
    { value: "humidity", label: "Humidity" },
    { value: "pressure", label: "Pressure" },
  ];

  // read role from localStorage user object
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

  // fetch users / devices initially
  useEffect(() => {
    const token = getToken();
    // GET users
    fetch("/api/users", authGet(token))
      .then((r) => r.json())
      .then((data) => {
        // try both shapes: {status, users} or raw array
        if (data && data.users) {
          setUsers(data.users);
        } else if (Array.isArray(data)) {
          setUsers(data);
        } else if (data && data.status === "success" && Array.isArray(data.users)) {
          setUsers(data.users);
        } else {
          setUsers([]);
        }
      })
      .catch(() => {
        setUsers([]);
      });

    // GET devices
    fetch("/api/devices", authGet(token))
      .then((r) => r.json())
      .then((data) => {
        if (data && data.devices) {
          setDevices(data.devices);
        } else if (Array.isArray(data)) {
          setDevices(data);
        } else {
          setDevices([]);
        }
      })
      .catch(() => {
        setDevices([]);
      });
  }, []);

  // fetch backend sensors when device changes (we still call backend for completeness)
  useEffect(() => {
    if (!deviceId) {
      setBackendSensors([]);
      return;
    }
    const token = getToken();
    // call sensors endpoint if available — expecting {status, sensors: [...]}
    fetch(`/api/sensors?device=${deviceId}`, authGet(token))
      .then((r) => r.json())
      .then((data) => {
        if (data && data.sensors && Array.isArray(data.sensors)) {
          setBackendSensors(data.sensors);
        } else if (Array.isArray(data)) {
          setBackendSensors(data);
        } else {
          setBackendSensors([]);
        }
      })
      .catch(() => {
        setBackendSensors([]);
      });
  }, [deviceId]);

  // allowed widgets per role (server-side should also enforce; frontend filters)
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
        return [];
    }
  };

  const allowedWidgets = allowedWidgetsForRole(role);

  // helper: auth headers
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

  // Role list derived from users (unique role names) + fallback list
  const roleOptions = React.useMemo(() => {
    const setRoles = new Set<string>();
    users.forEach((u: any) => {
      if (u.roles && Array.isArray(u.roles)) {
        u.roles.forEach((r: any) => {
          // r may be object {name} or string depending on backend
          if (typeof r === "string") setRoles.add(r);
          else if (typeof r === "object" && r.name) setRoles.add(r.name);
        });
      } else if (u.role) {
        setRoles.add(u.role);
      }
    });
    // ensure some core roles always present
    ["superadmin", "admin", "user"].forEach((r) => setRoles.add(r));
    return Array.from(setRoles);
  }, [users]);

  // filtered users by selected role (role filter); if role empty => show all
  const filteredUsers = React.useMemo(() => {
    if (!role) return users;
    return users.filter((u: any) => {
      // backend may return u.role or u.roles[]
      if (u.role) return u.role === role;
      if (u.roles && Array.isArray(u.roles)) {
        const names = u.roles.map((x: any) => (typeof x === "string" ? x : x.name));
        return names.includes(role);
      }
      return false;
    });
  }, [users, role]);

  // add widget to list (client-side)
  const addWidget = (e?: React.FormEvent) => {
    e?.preventDefault();
    setMessage("");

    if (!widgetType) {
      setMessage("Select a widget type.");
      return;
    }

    // validate chosen widget type is allowed for the role
    if (!allowedWidgets.some((w) => w.value === widgetType)) {
      setMessage("You are not permitted to add this widget type.");
      return;
    }

    // sensors/devices required for most widgets
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
      if (!sensor && widgetType !== "onoff") {
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
      sensor: sensor === "" ? null : sensor,
      config: {},
    };

    if (widgetType === "table") {
      wid.config = { columns: (tableColumns || "timestamp,value").split(",").map((c) => c.trim()) };
    }
    if (widgetType === "onoff") {
      wid.config = { mqttTopic, onPayload, offPayload, buttonLabel };
    }

    setWidgets((prev) => [...prev, wid]);

    // reset widget fields
    setWidgetType("");
    setTitle("");
    setDeviceId("");
    setSensor("");
    setTableColumns("");
    setMqttTopic("");
    setOnPayload("ON");
    setOffPayload("OFF");
    setButtonLabel("Toggle");
  };

  const removeWidget = (id: string) => setWidgets((w) => w.filter((x) => x.id !== id));

  // Save dashboard to backend
  const saveDashboard = async () => {
    setMessage("");
    if (!name) {
      setMessage("Dashboard name required.");
      return;
    }
    // If no user selected → auto assign dashboard to current user
      let finalOwnerId = assignUserId;
      try {
        const raw = localStorage.getItem("user");
        if (!finalOwnerId && raw) {
          const parsed = JSON.parse(raw);
          finalOwnerId = parsed.id; // current logged user ID
        }
      } catch {}

      if (!finalOwnerId) {
        setMessage("Unable to detect user.");
        return;
      }

    const payload = {
      name,
      description,
      owner_id: finalOwnerId,
      widgets: widgets.map((w) => ({
        widget_type: w.type,
        title: w.title,
        device_id: w.deviceId,
        sensor: w.sensor,
        config: w.config || {},
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
      // optionally clear form
      setName("");
      setDescription("");
      setAssignUserId("");
      setWidgets([]);
    } catch (err) {
      setMessage("Server error while saving dashboard.");
    }
  };

  // When device selected, pre-select sensor to empty and show fixed sensor options first.
  // We do still fetch backend sensors above — but per request the dropdown will show the fixed list.
  const handleDeviceChange = (val: number | "") => {
    setDeviceId(val);
    setSensor("");
    // backendSensors fetch is triggered by useEffect
  };

  // Choose sensor from combined options: fixed sensor types first, then backend sensors (if any)
  const renderSensorOptions = () => {
    const options: JSX.Element[] = [];
    // fixed sensor types
    FIXED_SENSOR_TYPES.forEach((s) => {
      options.push(
        <option key={`fixed_${s.value}`} value={s.value}>
          {s.label}
        </option>
      );
    });
    // if backend sensors exist for this device, show them separated
    if (backendSensors && backendSensors.length > 0) {
      options.push(
        <option key="sep_backend" disabled>
          — Backend sensors (topic) —
        </option>
      );
      backendSensors.forEach((s: any) => {
        const label = s.topic || s.id || s.payload || `sensor-${s.id}`;
        // use numeric id value to represent backend sensor (keeps compatibility)
        options.push(
          <option key={`backend_${s.id}`} value={s.id}>
            {label}
          </option>
        );
      });
    }
    return options;
  };

  // minimal preview label for sensor (resolve sensor to string label)
  const sensorLabel = (s: string | number | null | undefined) => {
    if (!s && s !== 0) return "—";
    if (typeof s === "string") {
      // match fixed sensors
      const found = FIXED_SENSOR_TYPES.find((x) => x.value === s);
      if (found) return found.label;
      // else maybe it's a backend topic string
      return s;
    }
    if (typeof s === "number") {
      // search backendSensors list
      const found = backendSensors.find((x) => Number(x.id) === Number(s));
      if (found) return found.topic || `sensor-${found.id}`;
      return `sensor-${s}`;
    }
    return String(s);
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
            <form className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">
                  <i className="bi bi-fonts mr-1"></i> Dashboard Name{" "}
                  <span className="text-red-500"></span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Factory Floor"
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  <i className="bi bi-card-text mr-1"></i> Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description"
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Role dropdown (filters assign-to user list) */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  <i className="bi bi-person-badge mr-1"></i> Role (filter users)
                </label>
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    // when role changes, clear assigned user selection
                    setAssignUserId("");
                  }}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All roles</option>
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assign to User */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  <i className="bi bi-person mr-1"></i> Assign to User{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={assignUserId}
                  onChange={(e) =>
                    setAssignUserId(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select user</option>
                  {filteredUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.username} {u.roles?.length ? `(${u.roles.map((r: any) => (typeof r === "string" ? r : r.name)).join(",")})` : ""}
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
            <form className="grid md:grid-cols-4 gap-4" onSubmit={(e) => { e.preventDefault(); addWidget(); }}>
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
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                  onChange={(e) => handleDeviceChange(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="">Select device</option>
                  {devices.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sensor: fixed 3 types + backend sensors if available */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  <i className="bi bi-activity mr-1"></i> Sensor{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={sensor}
                  onChange={(e) => {
                    // try parse numeric id -> use number; else string
                    const val = e.target.value;
                    if (/^\d+$/.test(val)) {
                      setSensor(Number(val));
                    } else {
                      setSensor(val);
                    }
                  }}
                >
                  <option value="">Select sensor</option>
                  {renderSensorOptions()}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Select a sensor type (Temperature / Humidity / Pressure) or a backend sensor topic.
                </p>
              </div>

              {/* conditional row for table */}
              {widgetType === "table" && (
                <div className="md:col-span-4">
                  <label className="block text-sm font-semibold mb-1">
                    <i className="bi bi-table mr-1"></i> Table Columns
                  </label>
                  <input
                    type="text"
                    value={tableColumns}
                    onChange={(e) => setTableColumns(e.target.value)}
                    placeholder="e.g. timestamp,value"
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* onoff config */}
              {widgetType === "onoff" && (
                <div className="md:col-span-4 grid md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">MQTT Topic</label>
                    <input
                      type="text"
                      value={mqttTopic}
                      onChange={(e) => setMqttTopic(e.target.value)}
                      placeholder="/device/relay"
                      className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">On Payload</label>
                    <input
                      type="text"
                      value={onPayload}
                      onChange={(e) => setOnPayload(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Off Payload</label>
                    <input
                      type="text"
                      value={offPayload}
                      onChange={(e) => setOffPayload(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Button Label</label>
                    <input
                      type="text"
                      value={buttonLabel}
                      onChange={(e) => setButtonLabel(e.target.value)}
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

        {/* Dashboard Widgets Section */}
        <div className="mb-6">
          <h5 className="font-semibold mb-3 flex items-center text-gray-100">
            <i className="bi bi-grid-3x3-gap mr-2"></i> Dashboard Widgets
          </h5>
          <div className="grid md:grid-cols-3 gap-4" id="dashboard-widgets">
            {widgets.length === 0 ? (
              <div className="border-2 border-dashed border-gray-700 rounded-lg h-32 flex items-center justify-center text-gray-500">
                No widgets added yet
              </div>
            ) : (
              widgets.map((w) => (
                <div key={w.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm text-gray-300 font-semibold">{w.title || `Widget: ${w.type}`}</div>
                      <div className="text-xs text-gray-400">{w.type}</div>
                      <div className="text-xs text-gray-400">
                        Device: {w.deviceId ?? "—"} Sensor: {sensorLabel(w.sensor)}
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

                  {/* Minimal "preview" box */}
                  <div className="mt-3 h-24 bg-gray-900 rounded-md border border-gray-800 flex items-center justify-center text-gray-500">
                    {w.type.includes("chart") ? (
                      <div>Chart preview ({w.type})</div>
                    ) : w.type === "table" ? (
                      <div>Table preview — columns: {(w.config?.columns || []).join(", ")}</div>
                    ) : w.type === "onoff" ? (
                      <div>On/Off control — topic: {w.config?.mqttTopic || mqttTopic}</div>
                    ) : (
                      <div>Preview</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Save Button */}
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
