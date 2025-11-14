"use client";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle } from "lucide-react";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setMessageType("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message || "Login failed");
        setMessageType("error");
        return;
      }

      // Store JWT + user info
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setMessage("Login successful!");
      setMessageType("success");

      setTimeout(() => navigate("/dashboard"), 800);

    } catch (error) {
      setMessage("Server error");
      setMessageType("error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#0B0B0F] text-gray-200">
      <div className="w-full max-w-md px-6">

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-[#121218] shadow-lg rounded-2xl p-6 border border-gray-700"
        >
          <h2 className="text-3xl font-bold text-center mb-4 text-white">
            Sign In
          </h2>

          <form onSubmit={handleLogin} autoComplete="off" className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                className="w-full p-3 border border-gray-600 rounded-lg bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                className="w-full p-3 border border-gray-600 rounded-lg bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-lg transition-all"
            >
              Login
            </button>
          </form>

          {message && (
            <div
              className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                messageType === "success"
                  ? "bg-green-900/40 text-green-400 border border-green-700"
                  : "bg-red-900/40 text-red-400 border border-red-700"
              }`}
            >
              {messageType === "success" ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span>{message}</span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
