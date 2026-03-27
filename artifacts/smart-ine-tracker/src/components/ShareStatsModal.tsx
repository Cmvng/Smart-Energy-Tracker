import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth, displayName } from "@/lib/auth";
import { format } from "date-fns";

const NAVY = "#0A1628";
const GREEN = "#00D37F";
const RED = "#FF4757";

const THEMES = [
  { id: "dark", label: "Dark Navy", bg: NAVY, text: "#FFFFFF", accent: GREEN },
  { id: "white", label: "Pure White", bg: "#FFFFFF", text: NAVY, accent: GREEN, border: "#E5E7EB" },
  { id: "profit", label: "Profit Green", bg: GREEN, text: "#FFFFFF", accent: "#FFFFFF" },
  { id: "purple", label: "Midnight Purple", bg: "#1a0533", text: "#FFFFFF", accent: GREEN },
];

const PROFIT_LINES = ["Crushing it! 💪", "On a roll! 🔥", "Profit mode activated 🚀"];
const LOSS_LINES = ["Every day is a new chance 💪", "Track it. Fix it. Win it 🎯"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
}

function getPeriodLabel(period: string, from?: string, to?: string): string {
  if (period === "custom" && from && to) {
    const f = format(new Date(from + "T12:00:00"), "MMM d");
    const t = format(new Date(to + "T12:00:00"), "MMM d, yyyy");
    return `${f}–${t}`;
  }
  const labels: Record<string, string> = { today: "Today", week: "This Week", month: "This Month" };
  return labels[period] ?? "This Period";
}

function getTimeframeParam(period: string): string {
  const map: Record<string, string> = { today: "day", week: "week", month: "month" };
  return map[period] ?? "day";
}

interface ShareStatsModalProps {
  onClose: () => void;
}

export default function ShareStatsModal({ onClose }: ShareStatsModalProps) {
  const { user, token } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);

  const [period, setPeriod] = useState<"today" | "week" | "month" | "custom">("week");
  const [themeId, setThemeId] = useState("dark");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return format(d, "yyyy-MM-dd");
  });
  const [toDate, setToDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [summary, setSummary] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState("");

  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    setLoadingData(true);
    try {
      let url = `/api/transactions/summary?`;
      if (period === "custom") {
        url += `timeframe=custom&from=${fromDate}&to=${toDate}`;
      } else {
        url += `timeframe=${getTimeframeParam(period)}`;
      }
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSummary(await res.json());
    } catch { /* ignore */ }
    finally { setLoadingData(false); }
  }, [token, period, fromDate, toDate]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const periodLabel = getPeriodLabel(period, fromDate, toDate);
  const net = summary?.net_usd ?? 0;
  const income = summary?.total_income_usd ?? 0;
  const expenses = summary?.total_expense_usd ?? 0;
  const txCount = summary?.transaction_count ?? 0;
  const daysInRange = summary?.days_in_range ?? (period === "week" ? 7 : period === "month" ? 30 : 1);
  const dailyAvg = Math.abs(net / Math.max(daysInRange, 1));
  const profitStatus = net > 0.005 ? "profit" : net < -0.005 ? "loss" : "breakeven";
  const motiveLine = profitStatus === "profit"
    ? PROFIT_LINES[Math.floor(Math.random() * PROFIT_LINES.length)]
    : profitStatus === "loss"
    ? LOSS_LINES[Math.floor(Math.random() * LOSS_LINES.length)]
    : null;

  const userDisplayName = displayName(user);

  const getInitials = () =>
    user?.name ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "U";

  const generateImage = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(cardRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      logging: false,
    });
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await generateImage();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smart-ine-${period}-${format(new Date(), "yyyy-MM-dd")}.png`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("✅ Card saved to your device!");
    } catch { showToast("❌ Could not generate image"); }
    finally { setDownloading(false); }
  };

  const getTweetText = () => {
    const sign = net >= 0 ? "+" : "-";
    const emoji = profitStatus === "profit" ? "🟢" : profitStatus === "loss" ? "🔴" : "🟡";
    return encodeURIComponent(
      `My finances ${period === "week" ? "this week" : period === "month" ? "this month" : "today"}:\n💚 Income: $${fmt(income)}\n❤️ Expenses: $${fmt(expenses)}\n${emoji} Net: ${sign}$${fmt(net)}\n\nTracked with Smart i-n-E Tracker\n${window.location.origin} #SmartINE #FinanceTracker #MoneyMoves`
    );
  };

  const handleShareX = async () => {
    setSharing(true);
    try {
      const blob = await generateImage();
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `smart-ine-${period}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Card downloaded! Tweet opens next — attach your card to the tweet 📎");
        setTimeout(() => window.open(`https://twitter.com/intent/tweet?text=${getTweetText()}`, "_blank"), 1200);
      }
    } catch { showToast("❌ Could not share"); }
    finally { setSharing(false); }
  };

  const handleNativeShare = async () => {
    setSharing(true);
    try {
      const blob = await generateImage();
      if (!blob) return;
      const file = new File([blob], `smart-ine-${period}.png`, { type: "image/png" });
      const sign = net >= 0 ? "+" : "-";
      const emoji = profitStatus === "profit" ? "🟢" : profitStatus === "loss" ? "🔴" : "🟡";
      const text = `My finances ${period === "week" ? "this week" : period === "month" ? "this month" : "today"}:\n💚 Income: $${fmt(income)}\n❤️ Expenses: $${fmt(expenses)}\n${emoji} Net: ${sign}$${fmt(net)}\n\nTracked with Smart i-n-E Tracker`;
      await navigator.share({ title: "My Finance Stats", text, files: [file] });
    } catch (e: any) {
      if (e.name !== "AbortError") showToast("❌ Share failed");
    } finally { setSharing(false); }
  };

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-bold" style={{ color: NAVY }}>📤 Share My Stats</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-lg hover:bg-gray-200">×</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Period selector */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Time Range</p>
            <div className="grid grid-cols-4 gap-1.5 bg-gray-100 p-1 rounded-xl">
              {(["today", "week", "month", "custom"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="py-2 text-xs font-semibold rounded-lg transition-all"
                  style={{
                    background: period === p ? NAVY : "transparent",
                    color: period === p ? "white" : "#6B7280",
                  }}
                >
                  {p === "today" ? "Today" : p === "week" ? "Week" : p === "month" ? "Month" : "Custom"}
                </button>
              ))}
            </div>
            {period === "custom" && (
              <div className="flex gap-2 mt-2">
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">From</p>
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#0A1628]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">To</p>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#0A1628]" />
                </div>
              </div>
            )}
          </div>

          {/* Theme selector */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Theme</p>
            <div className="flex gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setThemeId(t.id)}
                  className="flex-1 relative rounded-xl overflow-hidden transition-all"
                  style={{
                    height: 32,
                    background: t.bg,
                    border: themeId === t.id ? `2px solid ${GREEN}` : `2px solid ${t.border || t.bg}`,
                    boxShadow: themeId === t.id ? `0 0 0 2px ${GREEN}40` : "none",
                  }}
                  title={t.label}
                >
                  {themeId === t.id && (
                    <span style={{ color: t.text, fontSize: 12, fontWeight: 700 }}>✓</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              {THEMES.map((t) => (
                <p key={t.id} className="flex-1 text-center text-[9px] text-gray-400">{t.label}</p>
              ))}
            </div>
          </div>

          {/* Card preview */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Preview</p>
            {loadingData ? (
              <div className="h-64 flex items-center justify-center rounded-2xl bg-gray-50">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: GREEN, borderTopColor: "transparent" }} />
              </div>
            ) : (
              <div className="flex justify-center">
                {/* The actual card that gets screenshotted */}
                <div
                  ref={cardRef}
                  style={{
                    width: 340,
                    background: theme.bg,
                    borderRadius: 20,
                    padding: 24,
                    fontFamily: "'Outfit', sans-serif",
                    border: theme.border ? `1px solid ${theme.border}` : "none",
                    boxSizing: "border-box",
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 6, background: GREEN }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: theme.text, opacity: 0.9 }}>Smart i-n-E</span>
                    </div>
                    <span style={{ fontSize: 11, color: theme.text, opacity: 0.6 }}>{periodLabel}</span>
                  </div>

                  {/* Hero number */}
                  <div style={{ textAlign: "center", paddingBottom: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: theme.text, opacity: 0.6, marginBottom: 6 }}>
                      {profitStatus === "loss" ? "Net Loss" : "Net Profit"}
                    </p>
                    <p style={{ fontSize: 46, fontWeight: 800, color: profitStatus === "profit" ? GREEN : profitStatus === "loss" ? RED : "#F59E0B", lineHeight: 1, marginBottom: 8 }}>
                      {net >= 0 ? "+" : "-"}${fmt(net)}
                    </p>
                    <p style={{ fontSize: 28 }}>
                      {profitStatus === "profit" ? "🟢" : profitStatus === "loss" ? "🔴" : "🟡"}
                    </p>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: theme.text, opacity: 0.12, margin: "0 0 20px" }} />

                  {/* Stats grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                    {[
                      { icon: "💚", label: "Income", value: `$${fmt(income)}` },
                      { icon: "❤️", label: "Expenses", value: `$${fmt(expenses)}` },
                      { icon: "📊", label: "Transactions", value: `${txCount} logged` },
                      { icon: "📈", label: "Daily Avg", value: `$${fmt(dailyAvg)}/day` },
                    ].map(({ icon, label, value }) => (
                      <div key={label} style={{ padding: "10px 12px", borderRadius: 12, background: theme.text === "#FFFFFF" ? "rgba(255,255,255,0.08)" : "rgba(10,22,40,0.05)" }}>
                        <p style={{ fontSize: 10, color: theme.text, opacity: 0.55, marginBottom: 4 }}>{icon} {label}</p>
                        <p style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Motivational line */}
                  {motiveLine && (
                    <p style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: theme.accent, marginBottom: 16 }}>
                      {motiveLine}
                    </p>
                  )}

                  {/* Footer */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt="avatar" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: theme.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: theme.bg }}>
                          {getInitials()}
                        </div>
                      )}
                      <span style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>{userDisplayName}</span>
                    </div>
                    <span style={{ fontSize: 10, color: theme.text, opacity: 0.45 }}>tracked with Smart i-n-E</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pb-2">
            <button
              onClick={handleDownload}
              disabled={downloading || loadingData}
              className="w-full py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-60"
              style={{ background: NAVY, color: "white" }}
            >
              {downloading ? "⏳ Generating..." : "⬇️ Download Card"}
            </button>

            <div className="flex gap-2">
              <button
                onClick={handleShareX}
                disabled={sharing || loadingData}
                className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-60"
                style={{ background: "#000", color: "white" }}
              >
                {sharing ? "⏳" : "𝕏 Share on X"}
              </button>
              {canNativeShare ? (
                <button
                  onClick={handleNativeShare}
                  disabled={sharing || loadingData}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-60"
                  style={{ background: GREEN, color: "white" }}
                >
                  {sharing ? "⏳" : "📱 Share"}
                </button>
              ) : (
                <button
                  onClick={() => {
                    const sign = net >= 0 ? "+" : "-";
                    const emoji = profitStatus === "profit" ? "🟢" : profitStatus === "loss" ? "🔴" : "🟡";
                    const text = `My finances ${period}:\n💚 Income: $${fmt(income)}\n❤️ Expenses: $${fmt(expenses)}\n${emoji} Net: ${sign}$${fmt(net)}\n\nTracked with Smart i-n-E`;
                    navigator.clipboard.writeText(text).then(() => showToast("✅ Copied to clipboard!"));
                  }}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all border"
                  style={{ borderColor: NAVY, color: NAVY, background: "white" }}
                >
                  📋 Copy Text
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-sm font-semibold text-white shadow-xl z-[60]"
          style={{ background: NAVY }}>
          {toast}
        </div>
      )}
    </div>
  );
}
