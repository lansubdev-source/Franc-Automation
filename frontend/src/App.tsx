import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "@/pages/Login";
import Signup from "@/pages/Signup";

import Devices from "@/pages/Devices";
import Sensors from "@/pages/Sensors";
import Settings from "@/pages/Settings";
import LiveDataPage from "@/pages/LiveDataPage";
import DashboardBuilder from "@/pages/DashboardBuilder";
import Dashboards from "@/pages/Dashboards";
import DashboardPage from "@/pages/DashboardPage";
import RoleManagement from "@/pages/RoleManagement";
import UserManagement from "@/pages/UserManagement";
import NotFound from "@/pages/NotFound";
import History from "@/pages/History";

import ProtectedRoute from "@/components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin", "user"]}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/devices"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin", "user"]}>
                <Devices />
              </ProtectedRoute>
            }
          />

          <Route
            path="/sensors"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin", "user"]}>
                <Sensors />
              </ProtectedRoute>
            }
          />

          <Route
            path="/live"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin", "user"]}>
                <LiveDataPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin", "user"]}>
                <History />
              </ProtectedRoute>
            }
          />

          {/* <Route
            path="/dashboard-builder"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin", "user"]}>
                <DashboardBuilder />
              </ProtectedRoute>
            }
          /> */}

           <Route
            path="/dashboards"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin", "user"]}>
                <Dashboards />
              </ProtectedRoute>
            }
          />
          
          {/* Admin Only */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={["superadmin", "admin"]}>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Superadmin Only */}
          <Route
            path="/role-management"
            element={
              <ProtectedRoute allowedRoles={["superadmin"]}>
                <RoleManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/user-management"
            element={
              <ProtectedRoute allowedRoles={["superadmin"]}>
                <UserManagement />
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
