import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

const NAVY = "#0A1628";
const CARD_BG = "#1a2940";
const GREEN = "#00D37F";

const FLAG_MAP: Record<string, string> = {
  NGN: "🇳🇬", GBP: "🇬🇧", USD: "🇺🇸", EUR: "🇪🇺",
  KES: "🇰🇪", GHS: "🇬🇭", ZAR: "🇿🇦", INR: "🇮🇳",
  AED: "🇦🇪", CAD: "🇨🇦", AUD: "🇦🇺", JPY: "🇯🇵",
  TZS: "🇹🇿", UGX: "🇺🇬", MYR: "🇲🇾", BRL: "🇧🇷",
  CHF: "🇨🇭", SEK: "🇸🇪", NOK: "🇳🇴", DKK: "🇩🇰",
};

interface AdminStats {
  total_users: number;
  new_today: number;
  new_this_week: number;
  total_transactions: number;
  transactions_today: number;
  active_today: number;
  users_by_currency: { home_currency: string; count: number }[];
  recent_signups: {
    id: string; name: string; email: string; nickname: string | null;
    mode: string; home_currency: string; created_at: string;
    telegram_connected: boolean; transaction_count: string;
  }[];
}

interface FeedbackItem {
  id: string; user_id: string | null; rating: number;
  message: string | null; page: string | null; created_at: string;
  user_name: string | null; user_email: string | null;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ color: n <= rating ? "#f59e0b" : "#4b5563", fontSize: 14 }}>★</span>
      ))}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div style={{ background: CARD_BG, borderRadius: 12, padding: "16px 20px", flex: 1, minWidth: 0 }}>
      <div style={{ color: GREEN, fontSize: 28, fontWeight: 800, lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminPage() {
  const { token, user } = useAuth();
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "feedback">("overview");

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [statsRes, fbRes] = await Promise.all([
        fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/feedback", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (fbRes.ok) setFeedback(await fbRes.json());
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!user) return;
    if (user.is_admin === false) { setLocation("/dashboard"); return; }
    if (user.is_admin) { fetchData(); }
  }, [user, fetchData, setLocation]);

  useEffect(() => {
    const iv = setInterval(fetchData, 60_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  if (!user || (!user.is_admin && user.is_admin !== undefined)) {
    return null;
  }

  const maxCurrencyCount = stats?.users_by_currency?.[0]?.count ?? 1;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: NAVY, padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>🔐 Admin Dashboard</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>
              Smart i-n-E Tracker · {user.name}
              {lastRefresh && <span style={{ marginLeft: 8 }}>· Updated {timeAgo(lastRefresh.toISOString())}</span>}
            </div>
          </div>
          <button
            onClick={fetchData}
            style={{
              background: "rgba(0,211,127,0.15)", border: "1px solid rgba(0,211,127,0.4)",
              color: GREEN, borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer",
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginTop: 16 }}>
          {(["overview", "users", "feedback"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 500, textTransform: "capitalize",
                background: activeTab === tab ? GREEN : "rgba(255,255,255,0.08)",
                color: activeTab === tab ? "#0A1628" : "rgba(255,255,255,0.7)",
              }}
            >
              {tab}
              {tab === "feedback" && feedback.length > 0 && (
                <span style={{
                  marginLeft: 6, background: "rgba(255,255,255,0.2)",
                  borderRadius: 10, padding: "1px 6px", fontSize: 11,
                }}>{feedback.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "rgba(255,255,255,0.4)" }}>
            Loading dashboard…
          </div>
        ) : (

          /* ── OVERVIEW TAB ─────────────────────────────── */
          activeTab === "overview" && stats && (
            <>
              {/* Stat cards */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                <StatCard label="Total Users" value={stats.total_users} />
                <StatCard label="New Today" value={stats.new_today} sub={`${stats.new_this_week} this week`} />
                <StatCard label="Total Transactions" value={stats.total_transactions} sub={`${stats.transactions_today} today`} />
                <StatCard label="Active Today" value={stats.active_today} sub="unique accounts" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Users by Currency */}
                <div style={{ background: CARD_BG, borderRadius: 12, padding: 20 }}>
                  <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>Users by Currency</div>
                  {stats.users_by_currency.map((item) => (
                    <div key={item.home_currency} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                        <span>{FLAG_MAP[item.home_currency] ?? "🌐"} {item.home_currency}</span>
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>{item.count} users</span>
                      </div>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 3, background: GREEN,
                          width: `${Math.round((item.count / maxCurrencyCount) * 100)}%`,
                          transition: "width 0.6s ease",
                        }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick feedback summary */}
                <div style={{ background: CARD_BG, borderRadius: 12, padding: 20 }}>
                  <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>Feedback Summary</div>
                  {feedback.length === 0 ? (
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>No feedback yet</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 36, fontWeight: 800, color: "#f59e0b" }}>
                        {(feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1)}
                        <span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginLeft: 6 }}>/ 5</span>
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>
                        avg from {feedback.length} rating{feedback.length !== 1 ? "s" : ""}
                      </div>
                      <div style={{ marginTop: 16 }}>
                        {[5, 4, 3, 2, 1].map((star) => {
                          const cnt = feedback.filter((f) => f.rating === star).length;
                          return (
                            <div key={star} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 12, width: 12, color: "rgba(255,255,255,0.5)" }}>{star}</span>
                              <span style={{ color: "#f59e0b", fontSize: 12 }}>★</span>
                              <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ height: "100%", background: "#f59e0b", borderRadius: 3, width: `${Math.round((cnt / feedback.length) * 100)}%` }} />
                              </div>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", width: 20 }}>{cnt}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Recent Signups */}
              <div style={{ background: CARD_BG, borderRadius: 12, padding: 20, marginTop: 20 }}>
                <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>Recent Signups</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>User</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Mode</th>
                        <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Currency</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Txns</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Telegram</th>
                        <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recent_signups.map((u) => (
                        <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <td style={{ padding: "10px 8px" }}>
                            <div style={{ fontWeight: 500 }}>{u.name}</div>
                            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{u.email}</div>
                            {u.nickname && <div style={{ color: GREEN, fontSize: 11 }}>@{u.nickname}</div>}
                          </td>
                          <td style={{ padding: "10px 8px", color: "rgba(255,255,255,0.6)", textTransform: "capitalize" }}>{u.mode}</td>
                          <td style={{ padding: "10px 8px" }}>
                            <span style={{ fontSize: 16 }}>{FLAG_MAP[u.home_currency] ?? "🌐"}</span>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginLeft: 4 }}>{u.home_currency}</span>
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: parseInt(u.transaction_count) > 0 ? GREEN : "rgba(255,255,255,0.3)" }}>
                            {parseInt(u.transaction_count) || 0}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right" }}>
                            {u.telegram_connected
                              ? <span style={{ color: "#2CA5E0" }}>✓</span>
                              : <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                          </td>
                          <td style={{ padding: "10px 8px", textAlign: "right", color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                            {timeAgo(u.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )
        )}

        {/* ── USERS TAB ─────────────────────────────── */}
        {activeTab === "users" && stats && (
          <div style={{ background: CARD_BG, borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>
              All Users <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 400 }}>({stats.total_users} total)</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>User</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Mode</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 500 }}>Currency</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Txns</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Telegram</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Admin</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_signups.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "10px 8px" }}>
                        <div style={{ fontWeight: 500 }}>{u.name}</div>
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{u.email}</div>
                        {u.nickname && <div style={{ color: GREEN, fontSize: 11 }}>@{u.nickname}</div>}
                      </td>
                      <td style={{ padding: "10px 8px", color: "rgba(255,255,255,0.6)", textTransform: "capitalize" }}>{u.mode}</td>
                      <td style={{ padding: "10px 8px" }}>
                        <span>{FLAG_MAP[u.home_currency] ?? "🌐"} {u.home_currency}</span>
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: parseInt(u.transaction_count) > 0 ? GREEN : "rgba(255,255,255,0.3)" }}>
                        {parseInt(u.transaction_count) || 0}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right" }}>
                        {u.telegram_connected ? <span style={{ color: "#2CA5E0" }}>✓</span> : <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right" }}>
                        {(u as any).is_admin ? <span style={{ color: "#f59e0b" }}>🔐</span> : <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── FEEDBACK TAB ─────────────────────────────── */}
        {activeTab === "feedback" && (
          <div>
            {feedback.length === 0 ? (
              <div style={{ textAlign: "center", padding: 80, color: "rgba(255,255,255,0.4)" }}>No feedback submitted yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {feedback.map((f) => (
                  <div key={f.id} style={{ background: CARD_BG, borderRadius: 12, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          <Stars rating={f.rating} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b" }}>{f.rating}/5</span>
                          {f.page && (
                            <span style={{
                              fontSize: 10, background: "rgba(255,255,255,0.1)", borderRadius: 4,
                              padding: "2px 8px", color: "rgba(255,255,255,0.5)",
                            }}>/{f.page}</span>
                          )}
                        </div>
                        {f.message && (
                          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, marginBottom: 8, lineHeight: 1.5 }}>
                            "{f.message}"
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                          {f.user_name ?? "Anonymous"}
                          {f.user_email && <span style={{ marginLeft: 6, color: "rgba(255,255,255,0.3)" }}>· {f.user_email}</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
                        {timeAgo(f.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
