import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useAddSheet } from "@/lib/add-sheet-context";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

const NAVY = "#0A1628";
const GREEN = "#00D37F";
const RED = "#FF4757";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useApi<T>(url: string, enabled = true) {
  const { token } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token || !enabled) return;
    setLoading(true);
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setData(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, [url, token, enabled]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, reload: load };
}

function groupByDate(transactions: any[]) {
  const groups: Record<string, any[]> = {};
  for (const tx of transactions) {
    const d = new Date(tx.transacted_at);
    const key = format(d, "yyyy-MM-dd");
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }
  return groups;
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d");
}

export default function Dashboard() {
  const { user } = useAuth();
  const { showAddSheet, openAddSheet, closeAddSheet } = useAddSheet();
  const [timeframe, setTimeframe] = useState<"day" | "week" | "month" | "year">("week");
  const [, navigate] = useLocation();

  const { data: summary, loading: summaryLoading, reload: reloadSummary } =
    useApi<any>(`/api/transactions/summary?timeframe=${timeframe}`);
  const { data: transactions, loading: txLoading, reload: reloadTx } =
    useApi<any[]>(`/api/transactions?timeframe=${timeframe}`);

  const reload = useCallback(() => { reloadSummary(); reloadTx(); }, [reloadSummary, reloadTx]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollRef.current?.scrollTop === 0) touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = async (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (delta > 60 && !isRefreshing) {
      setIsRefreshing(true);
      await reload();
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const tabs = [
    { id: "day", label: "Today" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
    { id: "year", label: "Year" },
  ];

  const grouped = groupByDate(transactions ?? []);
  const txList = transactions ?? [];

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F6FA] relative pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 z-20">
        <header style={{ background: NAVY }} className="text-white px-5 pt-10 pb-3 md:pt-6">
          {/* Mobile header content */}
          <div className="flex justify-between items-center md:hidden">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: GREEN }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white"/>
                  <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h1 className="text-lg font-bold tracking-tight">Smart i-n-E</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded-full uppercase tracking-wider">
                {user?.mode || "user"}
              </span>
              <button
                onClick={() => navigate("/settings")}
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  : initials}
              </button>
            </div>
          </div>
          {/* Desktop header content */}
          <div className="hidden md:flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-white/60 text-sm mt-0.5">
                Welcome back, {user?.name?.split(" ")[0] || "there"}
              </p>
            </div>
            <button
              onClick={openAddSheet}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95 hover:brightness-110"
              style={{ background: GREEN }}
            >
              <span className="text-lg leading-none">+</span> Add Transaction
            </button>
          </div>
        </header>

        {/* Timeframe tabs */}
        <div style={{ background: NAVY }} className="px-5 pb-4 rounded-b-3xl shadow-xl">
          <div className="flex bg-black/20 p-1 rounded-2xl md:max-w-sm">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeframe(t.id as any)}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200 min-h-[44px] ${
                  timeframe === t.id ? "bg-white shadow-sm" : "text-white/70 hover:text-white"
                }`}
                style={{ color: timeframe === t.id ? NAVY : undefined }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {isRefreshing && (
          <div className="flex justify-center py-2 bg-[#F5F6FA]">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: GREEN, borderTopColor: "transparent" }} />
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="md:max-w-[1100px] md:w-full md:mx-auto md:px-8">

          {/* Summary Cards — 3-col grid on all sizes */}
          <div className="grid grid-cols-3 gap-2 px-3 pt-5 w-full md:gap-4 md:px-0 md:pt-6">
            <SummaryCard
              title="Total Income"
              amount={summary?.total_income_usd}
              color={GREEN}
              loading={summaryLoading}
              prefix="+"
              sub={`Rate: $${fmt(summary?.income_rate_per_hour ?? 0)}/hr`}
            />
            <SummaryCard
              title="Total Expenses"
              amount={summary?.total_expense_usd}
              color={RED}
              loading={summaryLoading}
              prefix="-"
              sub={`Rate: $${fmt(summary?.expense_rate_per_hour ?? 0)}/hr`}
            />
            <SummaryCard
              title="Net P&L"
              amount={summary?.net_usd}
              color={(summary?.net_usd ?? 0) >= 0 ? GREEN : RED}
              loading={summaryLoading}
              prefix={(summary?.net_usd ?? 0) >= 0 ? "+" : ""}
              sub={summary?.profit_status === "profit" ? "📈 Profitable" : summary?.profit_status === "loss" ? "📉 Loss period" : "➡️ Breaking even"}
            />
          </div>

          {/* Insight Banner */}
          {!summaryLoading && summary?.insight_message && (
            <div
              className="mx-5 mt-3 px-4 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 md:mx-0 md:mt-4"
              style={{
                background: summary.profit_status === "profit" ? "#00D37F18" : summary.profit_status === "loss" ? "#FF475718" : "#F0F0F0",
                color: summary.profit_status === "profit" ? "#00A860" : summary.profit_status === "loss" ? "#CC2232" : "#555",
              }}
            >
              <span>{summary.profit_status === "profit" ? "📈" : summary.profit_status === "loss" ? "📉" : "➡️"}</span>
              <span>{summary.insight_message}</span>
            </div>
          )}

          {/* Transactions */}
          <div className="px-5 py-5 md:px-0 md:py-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold" style={{ color: NAVY }}>
                Recent Transactions
                {!txLoading && txList.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-gray-400">({txList.length})</span>
                )}
              </h3>
            </div>

            {txLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />)}
              </div>
            ) : !txList.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-gray-100">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-4xl">💸</div>
                <p className="font-bold text-gray-700">No transactions yet</p>
                <p className="text-sm text-gray-400 mt-1">Use the + button to add your first entry</p>
              </div>
            ) : (
              <>
                {/* Mobile: grouped card list */}
                <div className="space-y-4 md:hidden">
                  {Object.entries(grouped)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([date, txs]) => (
                      <div key={date}>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{dateLabel(date)}</p>
                        <div className="space-y-2">
                          {txs.map((tx: any) => <TxRow key={tx.id} tx={tx} />)}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Desktop: table layout */}
                <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#F8F9FB" }}>
                        <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="text-right px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="text-right px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Currency</th>
                        <th className="text-right px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">USD Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {txList
                        .slice()
                        .sort((a: any, b: any) => new Date(b.transacted_at).getTime() - new Date(a.transacted_at).getTime())
                        .map((tx: any) => (
                          <TxTableRow key={tx.id} tx={tx} />
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* FAB — mobile only (desktop uses sidebar + header button) */}
      <button
        onClick={openAddSheet}
        className="fixed bottom-20 right-5 w-14 h-14 rounded-full shadow-xl flex items-center justify-center z-30 active:scale-95 transition-transform text-white text-2xl font-bold md:hidden"
        style={{ background: GREEN, boxShadow: `0 8px 24px ${GREEN}60` }}
      >
        +
      </button>

      {/* Add Sheet / Modal */}
      {showAddSheet && (
        <AddSheet
          onClose={closeAddSheet}
          onSaved={reload}
          userCurrency={user?.home_currency || "USD"}
        />
      )}
    </div>
  );
}

function SummaryCard({
  title, amount, color, loading, prefix = "", sub,
}: {
  title: string; amount?: number; color: string; loading: boolean; prefix?: string; sub?: string;
}) {
  return (
    <div className="min-w-0 overflow-hidden bg-white p-2.5 md:p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-1">
      <span className="text-[10px] md:text-xs font-semibold text-gray-500 truncate">{title}</span>
      {loading ? (
        <div className="h-6 bg-gray-100 rounded-lg animate-pulse w-full mt-1" />
      ) : (
        <span className="text-sm md:text-2xl font-bold truncate" style={{ color }}>
          {prefix}${fmt(Math.abs(amount ?? 0))}
        </span>
      )}
      {sub && !loading && (
        <span className="text-[9px] md:text-xs text-gray-400 mt-0.5 truncate">{sub}</span>
      )}
    </div>
  );
}

function TxRow({ tx }: { tx: any }) {
  const isIncome = tx.type === "income";
  return (
    <div
      className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[68px]"
      style={{ borderLeft: `4px solid ${isIncome ? GREEN : RED}` }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg"
        style={{ background: isIncome ? `${GREEN}18` : `${RED}18` }}
      >
        {isIncome ? "💰" : "💸"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate text-sm">{tx.notes || (isIncome ? "Income" : "Expense")}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatDistanceToNow(new Date(tx.transacted_at), { addSuffix: true })}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-sm" style={{ color: isIncome ? GREEN : NAVY }}>
          {isIncome ? "+" : "-"}{fmt(Number(tx.amount_original))} {tx.currency_code}
        </p>
        {tx.currency_code !== "USD" && tx.amount_usd && (
          <p className="text-xs text-gray-400 mt-0.5">≈ ${fmt(Number(tx.amount_usd))}</p>
        )}
      </div>
    </div>
  );
}

function TxTableRow({ tx }: { tx: any }) {
  const isIncome = tx.type === "income";
  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className="px-5 py-4 text-gray-500 text-xs whitespace-nowrap">
        {format(new Date(tx.transacted_at), "MMM d, yyyy")}
        <span className="block text-gray-400">{format(new Date(tx.transacted_at), "h:mm a")}</span>
      </td>
      <td className="px-5 py-4">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{
            background: isIncome ? `${GREEN}18` : `${RED}18`,
            color: isIncome ? "#00A860" : "#CC2232",
          }}
        >
          {isIncome ? "💰 Income" : "💸 Expense"}
        </span>
      </td>
      <td className="px-5 py-4 text-gray-800 font-medium max-w-[240px] truncate">
        {tx.notes || (isIncome ? "Income" : "Expense")}
      </td>
      <td className="px-5 py-4 text-right font-bold" style={{ color: isIncome ? GREEN : NAVY }}>
        {isIncome ? "+" : "-"}{fmt(Number(tx.amount_original))}
      </td>
      <td className="px-5 py-4 text-right text-gray-500 font-medium text-xs">
        {tx.currency_code}
      </td>
      <td className="px-5 py-4 text-right text-gray-600 font-semibold">
        ${fmt(Number(tx.amount_usd ?? tx.amount_original))}
      </td>
    </tr>
  );
}

const ALL_CURRENCIES = [
  "USD", "EUR", "GBP", "NGN", "KES", "GHS", "ZAR", "INR", "CAD", "AUD",
  "JPY", "CNY", "BRL", "MXN", "AED", "SAR", "PKR", "EGP", "TZS", "CHF",
];

function AddSheet({
  onClose, onSaved, userCurrency,
}: {
  onClose: () => void; onSaved: () => void; userCurrency: string;
}) {
  const { token } = useAuth();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(userCurrency);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [currencies, setCurrencies] = useState<any[]>([]);

  useEffect(() => {
    if (token) {
      fetch("/api/currencies", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : [])
        .then(setCurrencies)
        .catch(() => {});
    }
  }, [token]);

  const selectedCurrency = currencies.find((c) => c.code === currency);
  const rateToUsd = selectedCurrency ? parseFloat(selectedCurrency.rate_to_usd) : 1;
  const amountNum = parseFloat(amount) || 0;
  const amountUsd = amountNum * rateToUsd;

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type, amount_original: parseFloat(amount),
          currency_code: currency, notes, transacted_at: date,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(`❌ ${data.message || "Error saving"}`);
        setTimeout(() => setToast(""), 3000);
        return;
      }
      const sign = type === "income" ? "+" : "-";
      setToast(`✅ ${type === "income" ? "Income" : "Expense"} saved — ${sign}${fmt(parseFloat(amount))} ${currency}`);
      setTimeout(() => { setToast(""); onSaved(); onClose(); }, 1500);
    } catch {
      setToast("❌ Connection error. Try again.");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setSaving(false);
    }
  };

  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;

  const formContent = (isDesktop: boolean) => (
    <div className="flex flex-col" style={{ height: isDesktop ? "min(80vh, 620px)" : undefined }}>
      {/* Drag handle (mobile only) */}
      {!isDesktop && (
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-3 pb-3">
        <span className="text-base font-bold" style={{ color: NAVY }}>Quick Add</span>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xl leading-none font-bold hover:bg-gray-200 transition-colors"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {/* Type toggle — full width with no clipping */}
        <div className="grid grid-cols-2 gap-2 w-full">
          <button
            onClick={() => setType("income")}
            className="w-full py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 whitespace-nowrap"
            style={{
              background: type === "income" ? GREEN : "#F5F6FA",
              color: type === "income" ? "white" : "#888",
              border: `2px solid ${type === "income" ? GREEN : "#E5E5E5"}`,
            }}
          >
            💰 Income
          </button>
          <button
            onClick={() => setType("expense")}
            className="w-full py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 whitespace-nowrap"
            style={{
              background: type === "expense" ? RED : "#F5F6FA",
              color: type === "expense" ? "white" : "#888",
              border: `2px solid ${type === "expense" ? RED : "#E5E5E5"}`,
            }}
          >
            💸 Expense
          </button>
        </div>

        {/* Amount */}
        <div>
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 focus-within:border-[#0A1628] focus-within:ring-2 focus-within:ring-[#0A1628]/10 transition-all">
            <span className="text-2xl font-bold text-gray-400 mr-2 shrink-0">
              {currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency.slice(0, 3)}
            </span>
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 text-4xl font-bold text-center bg-transparent outline-none py-4 text-gray-900 placeholder-gray-300"
            />
          </div>
          {currency !== "USD" && amountNum > 0 && (
            <p className="text-center text-sm text-gray-400 mt-1.5">≈ ${fmt(amountUsd)} USD</p>
          )}
        </div>

        {/* Currency */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0A1628] transition-all"
          >
            {(currencies.length > 0 ? currencies : ALL_CURRENCIES.map((c) => ({ code: c, name: c }))).map((c: any) => (
              <option key={c.code} value={c.code}>{c.code} — {c.name || c.code}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Notes (optional)</label>
          <input
            type="text"
            placeholder="What was this for?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0A1628] transition-all"
          />
        </div>

        {/* Date */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Date & Time</label>
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0A1628] transition-all"
          />
        </div>
      </div>

      {/* Save button */}
      <div className="px-5 pb-6 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !amount || parseFloat(amount) <= 0}
          className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: type === "income" ? GREEN : RED }}
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            `${type === "income" ? "Save Income +" : "Save Expense −"}`
          )}
        </button>
      </div>
    </div>
  );

  const desktopModal = (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40, backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onClick={onClose}
      >
        <div
          style={{ background: "white", borderRadius: "24px", boxShadow: "0 25px 50px rgba(0,0,0,0.25)", width: "100%", maxWidth: "480px", overflow: "hidden" }}
          onClick={(e) => e.stopPropagation()}
        >
          {formContent(true)}
        </div>
      </div>
      {toast && (
        <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "#111827", color: "white", padding: "12px 20px", borderRadius: "16px", fontSize: "14px", fontWeight: 600, zIndex: 60, boxShadow: "0 10px 30px rgba(0,0,0,0.3)", textAlign: "center", maxWidth: 340 }}>
          {toast}
        </div>
      )}
    </>
  );

  const mobileSheet = (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40, backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderRadius: "24px 24px 0 0", zIndex: 50, boxShadow: "0 -8px 40px rgba(0,0,0,0.15)", height: "80vh", overflow: "hidden" }}
      >
        {formContent(false)}
      </div>
      {toast && (
        <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "#111827", color: "white", padding: "12px 20px", borderRadius: "16px", fontSize: "14px", fontWeight: 600, zIndex: 60, boxShadow: "0 10px 30px rgba(0,0,0,0.3)", textAlign: "center", maxWidth: 340 }}>
          {toast}
        </div>
      )}
    </>
  );

  return createPortal(isDesktop ? desktopModal : mobileSheet, document.body);
}
