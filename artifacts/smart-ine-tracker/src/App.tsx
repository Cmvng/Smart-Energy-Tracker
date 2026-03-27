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
import Sidebar from "@/components/Sidebar";
import Landing, { hasVisited } from "@/pages/landing";
import Onboarding, { isOnboardingDone } from "@/pages/onboarding";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F6FA]">
      <div className="w-8 h-8 border-4 border-[#00D37F] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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

function RootRoute() {
  const { token, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  if (token) return <Redirect to="/dashboard" />;
  if (hasVisited()) return <Redirect to="/login" />;
  return <Landing />;
}

const CHROME_PATHS = ["/dashboard", "/analytics", "/settings"];

function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { token } = useAuth();
  const showChrome = !!token && CHROME_PATHS.some((p) => location.startsWith(p));

  if (!showChrome) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

function AppRouter() {
  const { token } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !!token && !isOnboardingDone();
  });

  if (token && showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={RootRoute} />
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
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AddSheetProvider>
              <AppRouter />
            </AddSheetProvider>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
