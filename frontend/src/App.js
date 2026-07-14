import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "sonner";
import { api } from "@/lib/api";

import Login from "@/pages/Login";
import AppShell from "@/components/AppShell";
import Dashboard from "@/pages/Dashboard";
import Trades from "@/pages/Trades";
import CalendarPage from "@/pages/CalendarPage";
import Journal from "@/pages/Journal";
import Insights from "@/pages/Insights";
import Mentor from "@/pages/Mentor";
import CalculatorPage from "@/pages/Calculator";
import WeeklyAudit from "@/pages/WeeklyAudit";
import Challenges from "@/pages/Challenges";
import Pricing from "@/pages/Pricing";
import Affiliate from "@/pages/Affiliate";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-terminal-bg text-terminal-mute font-mono-num tracking-tighter">
        LOADING...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function ReferralCapture() {
  const [params] = useSearchParams();
  React.useEffect(() => {
    const ref = params.get("ref");
    if (ref) {
      const code = ref.trim().toUpperCase();
      localStorage.setItem("tj_ref", code);
      api.post("/affiliate/click", { code }).catch(() => {});
    }
  }, [params]);
  return null;
}

function App() {
  return (
    <div className="App min-h-screen bg-terminal-bg text-terminal-text">
      <AuthProvider>
        <BrowserRouter>
          <ReferralCapture />
          <Toaster theme="dark" position="bottom-right" richColors closeButton />
          <Routes>
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route
              path="/"
              element={
                <Protected>
                  <AppShell />
                </Protected>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="trades" element={<Trades />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="journal" element={<Journal />} />
              <Route path="insights" element={<Insights />} />
              <Route path="mentor" element={<Mentor />} />
              <Route path="calculator" element={<CalculatorPage />} />
              <Route path="audit" element={<WeeklyAudit />} />
              <Route path="challenges" element={<Challenges />} />
              <Route path="pricing" element={<Pricing />} />
              <Route path="affiliate" element={<Affiliate />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
