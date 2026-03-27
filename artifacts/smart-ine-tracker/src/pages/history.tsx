import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

const NAVY = "#0A1628";
const GREEN = "#00D37F";
const RED = "#FF4757";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

function groupByDate(txs: any[]) {
  const groups: Record<string, any[]> = {};
  for (const tx of txs) {
    const key = format(new Date(tx.transacted_at), "yyyy-MM-dd");
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  }
  return groups;
}

const PAGE_SIZE = 50;

type DateRange = "week" | "month" | "3months" | "all" | "custom";
type TypeFilter = "all" | "income" | "expense";
type SortMode = "newest" | "oldest" | "largest";

function buildUrl(
  range: DateRange, from: string, to: string,
  type: TypeFilter, sort: SortMode, search: string, offset: number
) {
  const params = new URLSearchParams();
  const today = new Date();
  const fmt2 = (d: Date) => d.toISOString().slice(0, 10);

  if (range === "week") {
    const s = new Date(today); s.setDate(today.getDate() - 6);
    params.set("from", fmt2(s)); params.set("to", fmt2(today));
  } else if (range === "month") {
    const s = new Date(today); s.setDate(today.getDate() - 29);
    params.set("from", fmt2(s)); params.set("to", fmt2(today));
  } else if (range === "3months") {
    const s = new Date(today); s.setDate(today.getDate() - 89);
    params.set("from", fmt2(s)); params.set("to", fmt2(today));
  } else if (range === "custom" && from) {
    params.set("from", from);
    if (to) params.set("to", to);
  }

  if (type !== "all") params.set("type", type);
  if (sort !== "newest") params.set("sort", sort);
  if (search.trim()) params.set("search", search.trim());
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));

  return `/api/transactions?${params.toString()}`;
}

function HxRow({
  tx, onEdit, onDelete, selectMode, selected, onSelect,
}: {
  tx: any;
  onEdit: (tx: any) => void;
  onDelete: (tx: any) => void;
  selectMode: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const isIncome = tx.type === "income";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div
      className="flex items-center gap-2 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[68px] transition-all"
      style={{
        borderLeft: `4px solid ${isIncome ? GREEN : RED}`,
        background: selected ? `${GREEN}08` : "white",
        borderColor: selected ? GREEN : undefined,
      }}
    >
      {selectMode && (
        <button
          onClick={() => onSelect(tx.id)}
          className="w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center transition-all"
          style={{ borderColor: selected ? GREEN : "#D1D5DB", background: selected ? GREEN : "white" }}
        >
          {selected && <span className="text-white text-xs font-bold">✓</span>}
        </button>
      )}
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
      {!selectMode && (
        <div ref={menuRef} className="relative shrink-0 ml-1">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors text-base"
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-30 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden w-48">
              <button onClick={() => { setMenuOpen(false); onEdit(tx); }}
                className="w-full flex items-center gap-2.5 px-4 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 text-left">
                ✏️ Edit transaction
              </button>
              <div className="border-t border-gray-50" />
              <button onClick={() => { setMenuOpen(false); onDelete(tx); }}
                className="w-full flex items-center gap-2.5 px-4 py-3.5 text-sm font-medium text-red-600 hover:bg-red-50 text-left">
                🗑️ Delete transaction
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ALL_CURRENCIES = [
  "USD", "EUR", "GBP", "NGN", "KES", "GHS", "ZAR", "INR", "CAD", "AUD",
  "JPY", "CNY", "BRL", "MXN", "AED", "SAR", "PKR", "EGP", "TZS", "CHF",
];

function EditSheet({
  tx, onClose, onSaved, userCurrency,
}: { tx: any; onClose: () => void; onSaved: () => void; userCurrency: string }) {
  const { token } = useAuth();
  const [type, setType] = useState<"expense" | "income">(tx.type);
  const [amount, setAmount] = useState(String(tx.amount_original));
  const [currency, setCurrency] = useState(tx.currency_code);
  const [notes, setNotes] = useState(tx.notes ?? "");
  const [date, setDate] = useState(new Date(tx.transacted_at).toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [currencies, setCurrencies] = useState<any[]>([]);

  useEffect(() => {
    if (token) {
      fetch("/api/currencies", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : []).then(setCurrencies).catch(() => {});
    }
  }, [token]);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, amount_original: parseFloat(amount), currency_code: currency, notes, transacted_at: date }),
      });
      const data = await res.json();
      if (!res.ok) { setToast(`❌ ${data.message || "Error saving"}`); setTimeout(() => setToast(""), 3000); return; }
      setToast("✅ Transaction updated!");
      setTimeout(() => { setToast(""); onSaved(); onClose(); }, 1200);
    } catch {
      setToast("❌ Connection error. Try again."); setTimeout(() => setToast(""), 3000);
    } finally { setSaving(false); }
  };

  return createPortal(
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40, backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderRadius: "24px 24px 0 0", zIndex: 50, height: "80vh", overflow: "hidden", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1.5 bg-gray-300 rounded-full" /></div>
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <span className="text-base font-bold" style={{ color: NAVY }}>Edit Transaction</span>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xl font-bold">×</button>
        </div>
        <div className="overflow-y-auto px-5 pb-4 space-y-4" style={{ height: "calc(80vh - 80px)" }}>
          <div className="grid grid-cols-2 gap-2">
            {(["income", "expense"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)} className="py-3 rounded-2xl font-bold text-sm transition-all"
                style={{ background: type === t ? (t === "income" ? GREEN : RED) : "#F5F6FA", color: type === t ? "white" : "#888", border: `2px solid ${type === t ? (t === "income" ? GREEN : RED) : "#E5E5E5"}` }}>
                {t === "income" ? "💰 Income" : "💸 Expense"}
              </button>
            ))}
          </div>
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 focus-within:border-[#0A1628] transition-all">
            <span className="text-2xl font-bold text-gray-400 mr-2 shrink-0">{currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency.slice(0, 3)}</span>
            <input type="number" inputMode="decimal" autoFocus placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent py-4 text-2xl font-bold text-gray-900 outline-none" />
          </div>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}
            className="w-full py-3.5 px-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium text-gray-700 outline-none">
            {ALL_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            {currencies.filter((c) => !ALL_CURRENCIES.includes(c.code)).map((c: any) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
          <input type="text" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full py-3.5 px-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:border-[#0A1628] transition-all" />
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full py-3.5 px-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm outline-none focus:border-[#0A1628] transition-all" />
          <button onClick={handleSave} disabled={saving || !amount || parseFloat(amount) <= 0}
            className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all active:scale-95 disabled:opacity-50"
            style={{ background: type === "income" ? GREEN : RED }}>
            {saving ? "Saving…" : "Save Changes ✓"}
          </button>
        </div>
      </div>
      {toast && createPortal(
        <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "#111827", color: "white", padding: "12px 20px", borderRadius: "16px", fontSize: "14px", fontWeight: 600, zIndex: 70, textAlign: "center", maxWidth: 340 }}>{toast}</div>,
        document.body
      )}
    </>,
    document.body
  );
}

export default function History() {
  const { token, user } = useAuth();
  const [, navigate] = useLocation();

  const [range, setRange] = useState<DateRange>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [txs, setTxs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [editingTx, setEditingTx] = useState<any>(null);
  const [deletingTx, setDeletingTx] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [globalToast, setGlobalToast] = useState("");

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const showToast = useCallback((msg: string) => {
    setGlobalToast(msg);
    setTimeout(() => setGlobalToast(""), 3000);
  }, []);

  const fetchTxs = useCallback(async (resetOffset = true) => {
    if (!token) return;
    const newOffset = resetOffset ? 0 : offset;
    if (resetOffset) setLoading(true); else setLoadingMore(true);
    try {
      const url = buildUrl(range, customFrom, customTo, typeFilter, sort, debouncedSearch, newOffset);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      const rows = data.transactions ?? [];
      const tot = data.total ?? 0;
      if (resetOffset) {
        setTxs(rows);
        setOffset(PAGE_SIZE);
      } else {
        setTxs((prev) => [...prev, ...rows]);
        setOffset((o) => o + PAGE_SIZE);
      }
      setTotal(tot);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token, range, customFrom, customTo, typeFilter, sort, debouncedSearch, offset]);

  useEffect(() => { fetchTxs(true); }, [range, customFrom, customTo, typeFilter, sort, debouncedSearch, token]);

  const handleDelete = useCallback(async () => {
    if (!deletingTx || deleting) return;
    const tx = deletingTx;
    setDeleting(true);
    setDeletingTx(null);
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("fail");
      setTxs((prev) => prev.filter((t) => t.id !== tx.id));
      setTotal((t) => t - 1);
      showToast("🗑️ Transaction deleted");
    } catch {
      showToast("❌ Could not delete. Try again.");
      fetchTxs(true);
    } finally { setDeleting(false); }
  }, [deletingTx, deleting, token, showToast, fetchTxs]);

  const handleBulkDelete = useCallback(async () => {
    if (!selectedIds.size || bulkDeleting) return;
    setBulkDeleting(true);
    setBulkConfirm(false);
    let failed = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        const res = await fetch(`/api/transactions/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { setTxs((prev) => prev.filter((t) => t.id !== id)); setTotal((t) => t - 1); }
        else failed++;
      } catch { failed++; }
    }
    setSelectedIds(new Set());
    setSelectMode(false);
    setBulkDeleting(false);
    showToast(failed > 0 ? `⚠️ ${failed} transaction(s) could not be deleted` : `🗑️ ${selectedIds.size} transaction(s) deleted`);
  }, [selectedIds, bulkDeleting, token, showToast]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const grouped = groupByDate(txs);
  const hasMore = txs.length < total;

  const rangeLabels: { id: DateRange; label: string }[] = [
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
    { id: "3months", label: "3 Months" },
    { id: "all", label: "All Time" },
    { id: "custom", label: "Custom" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F6FA]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors">
              ←
            </button>
            <h1 className="text-lg font-bold" style={{ color: NAVY }}>Transaction History</h1>
          </div>
          <div className="flex items-center gap-2">
            {selectMode && selectedIds.size > 0 && (
              <button
                onClick={() => setBulkConfirm(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                style={{ background: RED }}
              >
                Delete {selectedIds.size}
              </button>
            )}
            <button
              onClick={() => { setSelectMode((s) => !s); setSelectedIds(new Set()); }}
              className="px-3 py-2 rounded-xl text-xs font-bold border transition-all"
              style={{ borderColor: selectMode ? RED : "#E5E5E5", color: selectMode ? RED : "#666", background: "white" }}
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 pb-3 max-w-2xl mx-auto w-full space-y-2.5">
          {/* Date range pills */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {rangeLabels.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setRange(id); if (id === "custom") setShowCustom(true); else setShowCustom(false); }}
                className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: range === id ? NAVY : "#F5F6FA",
                  color: range === id ? "white" : "#666",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {showCustom && (
            <div className="flex gap-2">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none" />
              <span className="self-center text-gray-400 text-xs">to</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none" />
            </div>
          )}

          {/* Type + Sort row */}
          <div className="flex gap-2">
            <div className="flex gap-1">
              {(["all", "income", "expense"] as TypeFilter[]).map((t) => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className="px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all capitalize"
                  style={{ background: typeFilter === t ? (t === "income" ? GREEN : t === "expense" ? RED : NAVY) : "#F5F6FA", color: typeFilter === t ? "white" : "#666" }}>
                  {t === "income" ? "💰 Income" : t === "expense" ? "💸 Expense" : "All"}
                </button>
              ))}
            </div>
            <div className="ml-auto">
              <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}
                className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium outline-none text-gray-600">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="largest">Largest First</option>
              </select>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-gray-400 transition-all">
            <span className="text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search by notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder:text-gray-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600 text-sm">×</button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full">
        {/* Count bar */}
        {!loading && (
          <p className="text-xs text-gray-400 font-medium mb-3">
            {debouncedSearch ? `${txs.length} result${txs.length !== 1 ? "s" : ""} for "${debouncedSearch}"` : `Showing ${txs.length} of ${total} transaction${total !== 1 ? "s" : ""}`}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />)}
          </div>
        ) : txs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-4xl">
              {debouncedSearch || typeFilter !== "all" ? "🔍" : "💸"}
            </div>
            <p className="font-bold text-gray-700 text-base">
              {debouncedSearch || typeFilter !== "all" ? "No transactions match your search" : "No transactions yet"}
            </p>
            <p className="text-sm text-gray-400 mt-1.5">
              {debouncedSearch || typeFilter !== "all" ? "" : "Tap + in the dashboard to add your first entry"}
            </p>
            {(debouncedSearch || typeFilter !== "all" || range !== "all") && (
              <button
                onClick={() => { setSearch(""); setTypeFilter("all"); setRange("month"); setShowCustom(false); }}
                className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
                style={{ borderColor: NAVY, color: NAVY }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5 pb-24">
            {Object.entries(grouped)
              .sort(([a], [b]) => (sort === "oldest" ? a.localeCompare(b) : b.localeCompare(a)))
              .map(([dateKey, rows]) => (
                <div key={dateKey}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{dateLabel(dateKey)}</p>
                  <div className="space-y-2">
                    {rows.map((tx: any) => (
                      <HxRow
                        key={tx.id}
                        tx={tx}
                        onEdit={setEditingTx}
                        onDelete={setDeletingTx}
                        selectMode={selectMode}
                        selected={selectedIds.has(tx.id)}
                        onSelect={toggleSelect}
                      />
                    ))}
                  </div>
                </div>
              ))}

            {hasMore && (
              <button
                onClick={() => fetchTxs(false)}
                disabled={loadingMore}
                className="w-full py-3.5 rounded-2xl font-semibold text-sm border-2 transition-all"
                style={{ borderColor: "#E5E5E5", color: "#666" }}
              >
                {loadingMore ? "Loading…" : `Load more (${total - txs.length} remaining)`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Edit sheet */}
      {editingTx && (
        <EditSheet
          tx={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={() => { fetchTxs(true); setEditingTx(null); showToast("✅ Transaction updated!"); }}
          userCurrency={user?.home_currency || "USD"}
        />
      )}

      {/* Delete confirmation */}
      {deletingTx && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40, backdropFilter: "blur(4px)" }} onClick={() => setDeletingTx(null)} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderRadius: "24px 24px 0 0", zIndex: 50, padding: "24px 20px 40px", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}>
            <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto mb-5" />
            <h3 className="text-lg font-bold text-gray-900 mb-4">Delete this transaction?</h3>
            <div className="bg-gray-50 rounded-2xl p-4 mb-6 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: deletingTx.type === "income" ? GREEN : RED }} />
                <span className="text-sm font-semibold text-gray-700">{deletingTx.type === "income" ? "Income" : "Expense"}</span>
              </div>
              <p className="text-sm text-gray-800 font-bold">{deletingTx.type === "income" ? "+" : "-"}{fmt(Number(deletingTx.amount_original))} {deletingTx.currency_code}</p>
              {deletingTx.currency_code !== "USD" && deletingTx.amount_usd && (
                <p className="text-xs text-gray-400">≈ ${fmt(Number(deletingTx.amount_usd))} USD</p>
              )}
              <p className="text-xs text-gray-500">{format(new Date(deletingTx.transacted_at), "MMM d, yyyy · h:mm a")}</p>
              {deletingTx.notes && <p className="text-sm text-gray-600 italic">"{deletingTx.notes}"</p>}
            </div>
            <div className="space-y-3">
              <button onClick={handleDelete} disabled={deleting}
                className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all active:scale-95 disabled:opacity-60"
                style={{ background: RED }}>
                {deleting ? "Deleting…" : "Yes, Delete It"}
              </button>
              <button onClick={() => setDeletingTx(null)}
                className="w-full py-4 rounded-2xl font-bold text-sm border-2 transition-all active:scale-95"
                style={{ borderColor: "#E5E5E5", color: "#666" }}>
                Cancel
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Bulk delete confirmation */}
      {bulkConfirm && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40, backdropFilter: "blur(4px)" }} onClick={() => setBulkConfirm(false)} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderRadius: "24px 24px 0 0", zIndex: 50, padding: "24px 20px 40px", boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}>
            <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto mb-5" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete {selectedIds.size} transactions?</h3>
            <p className="text-sm text-gray-500 mb-6">This cannot be undone. Your data will be soft-deleted from the database.</p>
            <div className="space-y-3">
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all active:scale-95 disabled:opacity-60"
                style={{ background: RED }}>
                {bulkDeleting ? "Deleting…" : `Yes, Delete ${selectedIds.size} Transactions`}
              </button>
              <button onClick={() => setBulkConfirm(false)}
                className="w-full py-4 rounded-2xl font-bold text-sm border-2 transition-all"
                style={{ borderColor: "#E5E5E5", color: "#666" }}>
                Cancel
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Global toast */}
      {globalToast && createPortal(
        <div style={{ position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "#111827", color: "white", padding: "12px 20px", borderRadius: "16px", fontSize: "14px", fontWeight: 600, zIndex: 60, textAlign: "center", maxWidth: 340 }}>
          {globalToast}
        </div>,
        document.body
      )}
    </div>
  );
}
