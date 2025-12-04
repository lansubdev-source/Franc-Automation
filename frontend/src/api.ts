// src/api.ts

// Hard-coded backend API URL
const API_BASE = "http://localhost:5000/api";

export const api = {
  // Get all devices
  async getDevices() {
    const res = await fetch(`${API_BASE}/devices`);
    if (!res.ok) throw new Error("Failed to fetch devices");
    return res.json();
  },

  // Add new device
  async addDevice(data: any) {
    const res = await fetch(`${API_BASE}/devices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to add device");
    return res.json();
  },

  // Update device
  async updateDevice(id: number | string, data: any) {
    const res = await fetch(`${API_BASE}/devices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update device");
    return res.json();
  },

  // Delete device
  async deleteDevice(id: number | string) {
    const res = await fetch(`${API_BASE}/devices/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete device");
    return res.json();
  },
};
