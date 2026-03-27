import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, useAuth } from "@/lib/auth";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import AddTransaction from "@/pages/add";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import BottomNav from "@/components/BottomNav";

const queryClient = new QueryClient();

const PUBLIC_PATHS = ["/login", "/register"];

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-[#00D37F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-[#00D37F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (token) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function AppRouter() {
  const [location] = useLocation();
  const { token } = useAuth();
  const showNav = !!token && !PUBLIC_PATHS.includes(location);

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
        <Route path="/add">
          <ProtectedRoute component={AddTransaction} />
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

function MobileContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-background shadow-[0_0_50px_-12px_rgba(0,0,0,0.15)] relative overflow-x-hidden overflow-y-auto flex flex-col">
      {children}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <MobileContainer>
              <AppRouter />
            </MobileContainer>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
