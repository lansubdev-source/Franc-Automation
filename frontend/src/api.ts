// src/api.ts
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

export const api = {
  // 🔹 Get all devices
  async getDevices() {
    const res = await fetch(`${API_BASE}/devices`);
    if (!res.ok) throw new Error("Failed to fetch devices");
    return res.json();
  },

  // 🔹 Add a new device
  async addDevice(data: any) {
    const res = await fetch(`${API_BASE}/devices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to add device");
    return res.json();
  },

  // 🔹 Update an existing device
  async updateDevice(id: number | string, data: any) {
    const res = await fetch(`${API_BASE}/devices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update device");
    return res.json();
  },

  // 🔹 Delete a device
  async deleteDevice(id: number | string) {
    const res = await fetch(`${API_BASE}/devices/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete device");
    return res.json();
  },
};
