"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Edit, Trash2, UserPlus, Save, User, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

interface UserType {
  id: string;
  username: string;
  email: string;
  friendly_name?: string;
  image_url?: string;
  created_at?: string;
  is_active: boolean;
  roles?: { id: string; name: string }[];
  devices?: { id: string; name: string }[];
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const navigate = useNavigate();

  const API_BASE = "http://127.0.0.1:5000/api/users";

  // Fetch users and roles
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch(`${API_BASE}/all`),
        fetch(`${API_BASE}/roles`),
      ]);
      const usersData = await usersRes.json();
      const rolesData = await rolesRes.json();

      setUsers(usersData.users || []);
      setRoles(rolesData.roles || []);
    } catch (err) {
      console.error("Fetch error:", err);
      alert("Failed to fetch users from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Delete user
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
      if (res.ok) {
        alert("User deleted successfully!");
        fetchAllData();
      } else {
        alert("Failed to delete user");
      }
    } catch (err) {
      console.error(err);
      alert("Server error while deleting user.");
    }
  };

  // Add/Edit user
  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const id = formData.get("id")?.toString();

    const payload = {
      username: formData.get("username"),
      email: formData.get("email"),
      password: formData.get("password"),
      image_url: formData.get("image_url"),
      is_active: formData.get("is_active") === "true",
    };

    const url = id ? `${API_BASE}/${id}` : `${API_BASE}/register`;
    const method = id ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("User saved successfully!");
        setShowModal(false);
        fetchAllData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || "Failed to save user"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Server error while saving user.");
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen w-full bg-[#0d1117] text-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold flex items-center">
            <User className="text-yellow-400 mr-2" /> User Management
          </h1>
          <Button
            variant="outline"
            className="border-blue-500 text-blue-400 hover:bg-blue-600/20"
            onClick={() => navigate("/devices")}
          >
            <Server className="mr-1 h-4 w-4" /> Manage Devices
          </Button>
        </div>

        <Card className="bg-[#161b22] border-gray-700 text-gray-200">
          <CardHeader className="flex justify-between items-center border-b border-gray-700 pb-3">
            <h2 className="text-lg font-semibold flex items-center">
              <User className="text-yellow-400 mr-2" /> All Users
            </h2>
            <Button
              onClick={() => {
                setEditingUser(null);
                setShowModal(true);
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <UserPlus className="mr-2 h-4 w-4" /> Add User
            </Button>
          </CardHeader>

          <CardContent className="overflow-x-auto">
            {loading ? (
              <p className="text-gray-400 text-center py-4">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No users found.</p>
            ) : (
              <table className="min-w-full table-auto border-collapse text-sm">
                <thead className="bg-[#1f2937] text-gray-300">
                  <tr>
                    <th className="px-4 py-2 text-left">Photo</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Created</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Email</th>
                    <th className="px-4 py-2 text-left">Roles</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border-b border-gray-700 hover:bg-[#1f2937]/40"
                    >
                      <td className="px-4 py-2">
                        <img
                          src={u.image_url || "/default-user.png"}
                          alt="avatar"
                          className="w-9 h-9 rounded-full object-cover border border-gray-700"
                        />
                      </td>
                      <td className="px-4 py-2">{u.username}</td>
                      <td className="px-4 py-2">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            u.is_active ? "bg-green-700 text-green-100" : "bg-gray-700 text-gray-300"
                          }`}
                        >
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-2">{u.email}</td>
                      <td className="px-4 py-2">
                        {u.roles?.map((r) => (
                          <span
                            key={r.id}
                            className="bg-gray-700 text-gray-100 text-xs px-2 py-1 rounded mr-1"
                          >
                            {r.name}
                          </span>
                        ))}
                      </td>
                      <td className="px-4 py-2 text-center flex justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-500 text-blue-400 hover:bg-blue-700/30"
                          onClick={() => {
                            setEditingUser(u);
                            setShowModal(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500 text-red-400 hover:bg-red-700/30"
                          onClick={() => handleDelete(u.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit User Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <motion.form
              onSubmit={handleSave}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#161b22] p-6 rounded-2xl w-[420px] text-gray-200 border border-gray-700"
            >
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <User className="mr-2 text-blue-400" />
                {editingUser ? "Edit User" : "Add User"}
              </h2>

              {editingUser && <input type="hidden" name="id" value={editingUser.id} />}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm mb-1">Username</label>
                  <input
                    type="text"
                    name="username"
                    defaultValue={editingUser?.username || ""}
                    className="w-full bg-[#0d1117] border border-gray-700 p-2 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingUser?.email || ""}
                    className="w-full bg-[#0d1117] border border-gray-700 p-2 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Password</label>
                  <input
                    type="password"
                    name="password"
                    placeholder={editingUser ? "Leave blank to keep current password" : ""}
                    className="w-full bg-[#0d1117] border border-gray-700 p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Profile Image URL</label>
                  <input
                    type="url"
                    name="image_url"
                    defaultValue={editingUser?.image_url || ""}
                    className="w-full bg-[#0d1117] border border-gray-700 p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Status</label>
                  <select
                    name="is_active"
                    defaultValue={editingUser?.is_active ? "true" : "false"}
                    className="w-full bg-[#0d1117] border border-gray-700 p-2 rounded"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-5">
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-600 text-gray-400 hover:bg-gray-700/30"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" /> Save
                </Button>
              </div>
            </motion.form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default UserManagement;
