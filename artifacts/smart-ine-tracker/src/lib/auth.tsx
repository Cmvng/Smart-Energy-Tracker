import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useLocation } from "wouter";

const TOKEN_KEY = "ine_token";
const USER_KEY = "ine_user";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  mode: string;
  home_currency: string;
  notification_frequency?: string;
  avatar_url?: string;
  nickname?: string;
  created_at?: string;
}

export function displayName(user: UserProfile | null | undefined): string {
  if (!user) return "";
  return user.nickname ? "@" + user.nickname : user.name;
}

interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: UserProfile | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUserState] = useState<UserProfile | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    try { return stored ? JSON.parse(stored) : null; } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState(() => {
    return !!localStorage.getItem(TOKEN_KEY) && !localStorage.getItem(USER_KEY);
  });
  const [, setLocation] = useLocation();

  const setToken = useCallback((newToken: string | null) => {
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(newToken);
  }, []);

  const setUser = useCallback((newUser: UserProfile | null) => {
    if (newUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    } else {
      localStorage.removeItem(USER_KEY);
    }
    setUserState(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("ine_landing_v4");
    setTokenState(null);
    setUserState(null);
    setLocation("/");
  }, [setLocation]);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken && !user) {
      setIsLoading(true);
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${storedToken}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setUser(data);
          } else {
            logout();
          }
        })
        .catch(() => logout())
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, setToken, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
