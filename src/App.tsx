import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { CommandPalette } from "./components/layout/CommandPalette";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Technicians from "./pages/Technicians";
import Tickets from "./pages/Tickets";
import Settings from "./pages/Settings";
import AddUser from "./pages/Customers";
import NotFound from "./pages/NotFound";
import Machines from "./pages/Machines";
import Customers from "./pages/Customers";
import OtherCustomers from "./pages/OtherCustomers";

import { AuthProvider } from "./components/auth/AuthProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <CommandPalette />
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/technicians" element={<Technicians />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/other-customers" element={<OtherCustomers />} />
              <Route path="/machines" element={<Machines />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
