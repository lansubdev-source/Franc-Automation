"use client";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

interface Role {
  id: number;
  name: string;
  description: string;
}

interface Permission {
  id: number;
  name: string;
  description: string;
}

const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [newRole, setNewRole] = useState({ name: "", description: "" });
  const [newPermission, setNewPermission] = useState({ name: "", description: "" });
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedPermission, setSelectedPermission] = useState<string>("");
  const [assignedRoles, setAssignedRoles] = useState<{ [key: string]: string[] }>({});

  // Fetch roles & permissions
  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await fetch("http://127.0.0.1:5000/api/users/roles");
      const data = await res.json();
      setRoles(data.roles || data.data || []);
    } catch (err) {
      console.error("Error fetching roles:", err);
    }
  };

  const fetchPermissions = async () => {
    try {
      const res = await fetch("http://127.0.0.1:5000/api/users/permissions");
      const data = await res.json();
      setPermissions(data.permissions || data.data || []);
    } catch (err) {
      console.error("Error fetching permissions:", err);
    }
  };

  // Add new Role
  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.name.trim()) return alert("Role name is required!");
    try {
      const res = await fetch("http://127.0.0.1:5000/api/users/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_name: newRole.name.trim(),
          description: newRole.description.trim(),
        }),
      });
      if (res.ok) {
        setNewRole({ name: "", description: "" });
        fetchRoles();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || "Could not add role"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error adding role, check console.");
    }
  };

  // Add new Permission
  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPermission.name.trim()) return alert("Permission name is required!");
    try {
      const res = await fetch("http://127.0.0.1:5000/api/users/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permission_name: newPermission.name.trim(),
          description: newPermission.description.trim(),
        }),
      });
      if (res.ok) {
        setNewPermission({ name: "", description: "" });
        fetchPermissions();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || "Could not add permission"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error adding permission, check console.");
    }
  };

  // Assign Permission to Role
  const handleAssign = async () => {
    if (!selectedRole || !selectedPermission) return alert("Select both fields!");
    try {
      const res = await fetch("http://127.0.0.1:5000/api/users/assign-role-permission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_id: selectedRole, permission_id: selectedPermission }),
      });
      if (res.ok) {
        setAssignedRoles((prev) => {
          const existing = prev[selectedRole] || [];
          if (!existing.includes(selectedPermission)) {
            return { ...prev, [selectedRole]: [...existing, selectedPermission] };
          }
          return prev;
        });
        setSelectedPermission("");
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || "Could not assign permission"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error assigning permission, check console.");
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0b0f19] text-gray-200 p-6">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl font-bold mb-8 text-center text-white"
        >
          Role & Permission Management
        </motion.h1>

        {/* Add Role + Permission */}
        <div className="grid md:grid-cols-2 gap-10">
          {/* Add Role Section */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900 rounded-2xl p-6 shadow-lg"
          >
            <h2 className="text-xl font-semibold mb-4 text-white">Add Role</h2>
            <form onSubmit={handleAddRole} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Role Name"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                className="p-2 rounded bg-gray-800 text-gray-100 border border-gray-700 focus:ring focus:ring-blue-600"
                required
              />
              <input
                type="text"
                placeholder="Description"
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                className="p-2 rounded bg-gray-800 text-gray-100 border border-gray-700 focus:ring focus:ring-blue-600"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 transition rounded-lg p-2 font-medium"
              >
                Add Role
              </button>
            </form>
          </motion.div>

          {/* Add Permission Section */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900 rounded-2xl p-6 shadow-lg"
          >
            <h2 className="text-xl font-semibold mb-4 text-white">Add Permission</h2>
            <form onSubmit={handleAddPermission} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Permission Name"
                value={newPermission.name}
                onChange={(e) => setNewPermission({ ...newPermission, name: e.target.value })}
                className="p-2 rounded bg-gray-800 text-gray-100 border border-gray-700 focus:ring focus:ring-blue-600"
                required
              />
              <input
                type="text"
                placeholder="Description"
                value={newPermission.description}
                onChange={(e) =>
                  setNewPermission({ ...newPermission, description: e.target.value })
                }
                className="p-2 rounded bg-gray-800 text-gray-100 border border-gray-700 focus:ring focus:ring-blue-600"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 transition rounded-lg p-2 font-medium"
              >
                Add Permission
              </button>
            </form>
          </motion.div>
        </div>

        {/* Assign Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gray-900 mt-10 rounded-2xl p-6 shadow-lg max-w-3xl mx-auto"
        >
          <h2 className="text-xl font-semibold mb-4 text-white text-center">
            Assign Permissions to Role
          </h2>

          <div className="flex flex-col md:flex-row gap-4 justify-center mb-4">
            {/* Role Dropdown */}
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-gray-800 text-gray-100 rounded p-2 border border-gray-700"
            >
              <option value="">Select Role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id.toString()}>
                  {r.name}
                </option>
              ))}
            </select>

            {/* Permission Dropdown */}
            <select
              value={selectedPermission}
              onChange={(e) => setSelectedPermission(e.target.value)}
              className="bg-gray-800 text-gray-100 rounded p-2 border border-gray-700"
            >
              <option value="">Select Permission</option>
              {permissions.map((p) => {
                const alreadyAssigned = selectedRole
                  ? assignedRoles[selectedRole]?.includes(p.id.toString())
                  : false;
                return (
                  <option
                    key={p.id}
                    value={p.id.toString()}
                    disabled={alreadyAssigned}
                  >
                    {p.name} {alreadyAssigned ? "(assigned)" : ""}
                  </option>
                );
              })}
            </select>

            <button
              onClick={handleAssign}
              className="bg-green-600 hover:bg-green-700 transition rounded-lg px-4 py-2 font-medium"
            >
              Assign
            </button>
          </div>

          {/* Assigned Permissions Display */}
          <div className="text-gray-300 text-sm">
            {Object.keys(assignedRoles).length > 0 ? (
              Object.entries(assignedRoles).map(([roleId, perms]) => {
                const role = roles.find((r) => r.id === Number(roleId));
                return (
                  <div key={roleId} className="mb-3">
                    <strong className="text-white">{role?.name}:</strong>{" "}
                    {perms.map((pid) => {
                      const perm = permissions.find((p) => p.id === Number(pid));
                      return (
                        <span
                          key={pid}
                          className="inline-block bg-blue-700 text-white text-xs px-2 py-1 rounded ml-1"
                        >
                          {perm?.name}
                        </span>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <p className="text-center text-gray-500">No assignments yet.</p>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default RoleManagement;
