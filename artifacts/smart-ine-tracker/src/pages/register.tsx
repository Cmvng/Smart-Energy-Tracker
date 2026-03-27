import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

const CURRENCIES = [
  { code: "USD", name: "US Dollar" }, { code: "EUR", name: "Euro" }, { code: "GBP", name: "British Pound" },
  { code: "NGN", name: "Nigerian Naira" }, { code: "KES", name: "Kenyan Shilling" }, { code: "GHS", name: "Ghanaian Cedi" },
  { code: "ZAR", name: "South African Rand" }, { code: "INR", name: "Indian Rupee" }, { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" }, { code: "JPY", name: "Japanese Yen" }, { code: "CNY", name: "Chinese Yuan" },
  { code: "CHF", name: "Swiss Franc" }, { code: "AED", name: "UAE Dirham" }, { code: "SAR", name: "Saudi Riyal" },
];

export default function Register() {
  const [, setLocation] = useLocation();
  const { setToken, setUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"individual" | "business">("individual");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, mode, home_currency: currency }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Could not create account. Please try again.");
        return;
      }
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
        <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
        <Link href="/login" className="inline-flex items-center text-white/70 hover:text-white mb-8 text-sm font-medium">
          ← Back to Login
        </Link>
        <h1 className="text-white text-3xl font-bold mb-2">Create account</h1>
        <p className="text-white/60 text-sm">Start tracking your income and expenses</p>
      </div>

      <div className="flex-1 px-6 -mt-8 relative z-10 pb-8">
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-black/5 border border-gray-100">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {(["individual", "business"] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMode(m)}
                  className={`py-3 rounded-xl border-2 text-sm font-bold capitalize transition-all ${
                    mode === m
                      ? "border-[#0A1628] bg-[#0A1628] text-white"
                      : "border-gray-200 text-gray-500 bg-gray-50"
                  }`}
                >
                  {m === "individual" ? "👤 Individual" : "🏢 Business"}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0A1628] focus:ring-2 focus:ring-[#0A1628]/10 transition-all"
              />
            </div>
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
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0A1628] focus:ring-2 focus:ring-[#0A1628]/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Home Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0A1628] transition-all"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00D37F] text-white font-bold py-3.5 rounded-xl text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Create Account →"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[#0A1628] font-bold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
