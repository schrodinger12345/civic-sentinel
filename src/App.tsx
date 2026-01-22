import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Pages
import Index from "./pages/Index";
import System from "./pages/System";
import NotFound from "./pages/NotFound";

// Auth Pages
import AuthGateway from "./pages/AuthGateway";
import RoleSelection from "./pages/RoleSelection";
import GetStarted from "./pages/GetStarted";
import OfficialAuth from "./pages/OfficialAuth";
import CitizenOnboarding from "./pages/onboarding/CitizenOnboarding";
import OfficialOnboarding from "./pages/onboarding/OfficialOnboarding";

// Dashboard Pages
import CitizenDashboard from "./pages/dashboard/CitizenDashboard";
import OfficialDashboard from "./pages/dashboard/OfficialDashboard";

// Report Page
import ReportIssue from "./pages/ReportIssue";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/system" element={<System />} />

              {/* Auth Routes */}
              <Route path="/get-started" element={<GetStarted />} />
              <Route path="/auth" element={<AuthGateway />} />
              <Route path="/auth/official" element={<OfficialAuth />} />
              <Route path="/role-selection" element={<RoleSelection />} />

              {/* Onboarding Routes */}
              <Route path="/onboarding/citizen" element={<CitizenOnboarding />} />
              <Route path="/onboarding/official" element={<OfficialOnboarding />} />

              {/* Protected Dashboard Routes */}
              <Route
                path="/dashboard/citizen"
                element={
                  <ProtectedRoute allowedRoles={['citizen']}>
                    <CitizenDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/report"
                element={
                  <ProtectedRoute allowedRoles={['citizen']}>
                    <ReportIssue />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/official"
                element={<OfficialDashboard />}
              />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

