"use client";
import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { motion } from "framer-motion";
import { Loader2, Lock, PlusCircle, Cpu, Thermometer, Gauge, Wind } from "lucide-react";

const DashboardBuilder: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [allowedWidgets, setAllowedWidgets] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [addedWidgets, setAddedWidgets] = useState<any[]>([]);

  // Fetch allowed widget list from backend
  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setError("Unauthorized");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/dashboard/builder/widgets", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Permission error");
        setLoading(false);
        return;
      }

      setAllowedWidgets(data.widgets);
      setLoading(false);
    } catch (err) {
      setError("Server error");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const addWidget = (type: string) => {
    setAddedWidgets((prev) => [...prev, { type }]);
  };

  const widgetIcons: any = {
    temperature: <Thermometer className="w-6 h-6 text-red-400" />,
    humidity: <Wind className="w-6 h-6 text-blue-400" />,
    pressure: <Gauge className="w-6 h-6 text-purple-400" />,
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-screen text-gray-300">
          <Loader2 className="animate-spin w-10 h-10" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center mt-20 text-red-400 text-xl flex flex-col items-center">
          <Lock className="w-12 h-12 mb-3 opacity-70" />
          {error}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 text-gray-200 bg-gray-900 min-h-screen">

        {/* Header */}
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-white mb-8"
        >
          Dashboard Builder
        </motion.h2>

        {/* Allowed Widgets */}
        <div className="grid md:grid-cols-3 gap-6">
          {allowedWidgets.map((widget) => (
            <motion.div
              key={widget}
              whileHover={{ scale: 1.02 }}
              className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow hover:shadow-lg hover:border-blue-500 transition cursor-pointer"
              onClick={() => addWidget(widget)}
            >
              <div className="flex items-center gap-3 mb-2">
                {widgetIcons[widget]}
                <h3 className="text-xl capitalize font-semibold text-gray-100">
                  {widget} Widget
                </h3>
              </div>
              <p className="text-gray-400 text-sm">
                Add this widget to your dashboard.
              </p>
              <button className="mt-3 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white font-medium">
                <PlusCircle className="w-5 h-5" />
                Add Widget
              </button>
            </motion.div>
          ))}
        </div>

        {/* Added Widgets Section */}
        <div className="mt-10">
          <h3 className="text-xl font-semibold text-gray-100 mb-3">
            Added Widgets
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {addedWidgets.length === 0 ? (
              <div className="text-gray-500 border border-gray-700 p-6 rounded-lg text-center">
                No widgets added yet.
              </div>
            ) : (
              addedWidgets.map((widget, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-800 p-5 border border-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {widgetIcons[widget.type]}
                    <p className="text-white font-semibold capitalize">
                      {widget.type}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end mt-8">
          <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg text-lg font-semibold shadow-lg">
            Save Dashboard
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardBuilder;
