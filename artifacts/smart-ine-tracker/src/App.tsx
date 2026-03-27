import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, useAuth } from "@/lib/auth";
import { AddSheetProvider } from "@/lib/add-sheet-context";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import BottomNav from "@/components/BottomNav";
import Onboarding, { isOnboardingDone } from "@/pages/onboarding";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const PUBLIC_PATHS = ["/login", "/register"];

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { token, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  if (!token) return <Redirect to="/login" />;
  return <Component />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { token, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  if (token) return <Redirect to="/dashboard" />;
  return <Component />;
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA]">
      <div className="w-8 h-8 border-4 border-[#00D37F] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppRouter() {
  const [location] = useLocation();
  const { token } = useAuth();
  const showNav = !!token && !PUBLIC_PATHS.includes(location);

  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !!token && !isOnboardingDone();
  });

  if (token && showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <>
      <Switch>
        <Route path="/">
          <Redirect to="/dashboard" />
        </Route>
        <Route path="/login">
          <PublicRoute component={Login} />
        </Route>
        <Route path="/register">
          <PublicRoute component={Register} />
        </Route>
        <Route path="/dashboard">
          <ProtectedRoute component={Dashboard} />
        </Route>
        <Route path="/analytics">
          <ProtectedRoute component={Analytics} />
        </Route>
        <Route path="/settings">
          <ProtectedRoute component={Settings} />
        </Route>
        <Route component={NotFound} />
      </Switch>
      {showNav && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AddSheetProvider>
              <div className="w-full max-w-[430px] mx-auto min-h-screen bg-[#F5F6FA] shadow-xl relative overflow-x-hidden flex flex-col md:max-w-none">
                <AppRouter />
              </div>
            </AddSheetProvider>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
