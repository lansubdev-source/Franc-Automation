"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

interface DashboardType {
  id: number;
  name: string;
  description: string;
  widgets: any[];
}

const Dashboards: React.FC = () => {
  const navigate = useNavigate();

  const [dashboards, setDashboards] = useState<DashboardType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // -------------------------------------------
  // GET TOKEN FROM localStorage (if available)
  // -------------------------------------------
  const getAuthHeaders = () => {
    const raw = localStorage.getItem("user");
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed.token) {
        return { Authorization: `Bearer ${parsed.token}` };
      }
    } catch {}
    return {};
  };

  // -------------------------------------------
  // FETCH DASHBOARDS FROM BACKEND
  // -------------------------------------------
  const fetchDashboards = async () => {
    try {
      const res = await fetch("/api/dashboards?user=superadmin", {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      const data = await res.json();

      if (Array.isArray(data)) {
        setDashboards(data);
      } else if (Array.isArray(data.dashboards)) {
        setDashboards(data.dashboards);
      }
    } catch (err) {
      console.error("Error fetching dashboards", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboards();
  }, []);

  // -------------------------------------------
  // NAVIGATE TO NEW DASHBOARD BUILDER
  // -------------------------------------------
  const goToBuilder = () => {
    navigate("/dashboard-builder");
  };

  return (
    <DashboardLayout>
      <div className="p-6 text-gray-100 bg-[#0B0B0F] min-h-screen">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <i className="bi bi-kanban text-blue-500"></i> Dashboards
            </h2>
            <p className="text-gray-400 mt-1">
              Manage all dashboards and templates. Create, edit, duplicate,
              assign, or save as template.
            </p>
          </div>

          <div className="flex gap-3 mt-4 md:mt-0">
            <Button
              onClick={goToBuilder}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <i className="bi bi-plus-lg"></i> New Dashboard
            </Button>

            <Button
              variant="outline"
              className="border-gray-600 text-gray-200 hover:bg-gray-800 flex items-center gap-2"
            >
              <i className="bi bi-layers"></i> Templates
            </Button>
          </div>
        </div>

        {/* Table Card */}
        <Card className="bg-[#141418] border border-gray-700 shadow-md">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="bg-[#1E1E24] text-gray-400 uppercase text-xs">
                  <tr>
                    <th scope="col" className="px-6 py-3 font-medium">Name</th>
                    <th scope="col" className="px-6 py-3 font-medium">Description</th>
                    <th scope="col" className="px-6 py-3 font-medium">Type</th>
                    <th scope="col" className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-400">
                        Loading...
                      </td>
                    </tr>
                  ) : dashboards.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-400">
                        No dashboards found.
                      </td>
                    </tr>
                  ) : (
                    dashboards.map((d) => (
                      <tr
                        key={d.id}
                        className="border-b border-gray-800 hover:bg-[#1A1A1F]"
                      >
                        <td className="px-6 py-4">{d.name}</td>
                        <td className="px-6 py-4">{d.description}</td>

                        {/* Type = count of widgets */}
                        <td className="px-6 py-4">
                          {d.widgets?.length ? `${d.widgets.length} Widgets` : "—"}
                        </td>

                        <td className="px-6 py-4 flex gap-3">
                          <button className="text-blue-400 hover:underline text-sm">
                            View
                          </button>
                          <button className="text-yellow-400 hover:underline text-sm">
                            Edit
                          </button>
                          <button className="text-red-400 hover:underline text-sm">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Modal placeholder */}
        <div
          id="dashboardActionModal"
          className="hidden fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center"
        >
          <div className="bg-[#1E1E24] rounded-xl shadow-lg w-[90%] md:w-[400px]">
            <div className="bg-blue-600 text-white px-4 py-2 rounded-t-xl flex justify-between items-center">
              <h5 className="font-semibold">Dashboard Action</h5>
              <button className="text-white text-xl">&times;</button>
            </div>
            <div id="dashboard-action-modal-body" className="p-4 text-gray-300">
              {/* Dynamic content will load here */}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboards;
