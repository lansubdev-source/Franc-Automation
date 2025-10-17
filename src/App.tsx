import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "@/pages/Login";
import Devices from "@/pages/Devices";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import RoleManagement from "@/pages/RoleManagement";
import UserManagement from "@/pages/UserManagement";
import Sensors from "@/pages/Sensors";
import { DataTable } from "@/pages/DataTable";
import DashboardBuilder from "@/pages/DashboardBuilder";
import Dashboards from "@/pages/Dashboards";
import  DashboardPage  from "@/pages/DashboardPage";

const queryClient = new QueryClient();

// TODO: Replace this with your actual data source
const tableData: any[] = [];

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/sensors" element={<Sensors />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/roles" element={<RoleManagement />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/live" element={<DataTable title="Recent Device Activity" data={tableData} />} />
          <Route path="/dashboard-builder" element={<DashboardBuilder />} />
          <Route path="/dashboards" element={<Dashboards />} />
          {/* Add more routes like live-data, history later */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
