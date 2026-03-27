import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { markVisited } from "@/pages/landing";

export default function Login() {
  const [, setLocation] = useLocation();
  const { setToken, setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Invalid credentials. Please try again.");
        return;
      }
      markVisited();
      setToken(data.token);
      setUser(data.user);
      setLocation("/dashboard");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F6FA]">
      <div className="bg-[#0A1628] px-6 pt-12 pb-20 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute top-8 right-8 w-20 h-20 rounded-full bg-[#00D37F]/10" />
        <div className="flex items-center justify-between mb-8">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
            style={{ fontSize: 14, padding: 8 }}
          >
            <span style={{ fontSize: 20 }}>←</span>
            <span style={{ fontSize: 14 }}>Back</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00D37F] flex items-center justify-center shadow-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white"/>
                <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-white text-base font-bold">Smart i-n-E</span>
          </div>
          <div style={{ width: 60 }} />
        </div>
        <h1 className="text-white text-3xl font-bold mb-2">Welcome back</h1>
        <p className="text-white/60 text-sm">Sign in to continue tracking your finances</p>
      </div>

      <div className="flex-1 px-6 -mt-8 relative z-10">
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-black/5 border border-gray-100">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0A1628] focus:ring-2 focus:ring-[#0A1628]/10 transition-all"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <button type="button" className="text-xs text-[#0A1628] font-semibold hover:underline">
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0A1628] focus:ring-2 focus:ring-[#0A1628]/10 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0A1628] text-white font-bold py-3.5 rounded-xl text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Sign In →"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{" "}
          <Link href="/register" className="text-[#0A1628] font-bold hover:underline">
            Create one
          </Link>
        </p>

      </div>
    </div>
  );
}
