import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

const NAVY = "#0A1628";
const GREEN = "#00D37F";
const RED = "#FF4757";

const NOTIF_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "every_3_days", label: "Every 3 Days" },
  { value: "weekly", label: "Weekly" },
  { value: "off", label: "Off" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{title}</p>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">{children}</div>
    </div>
  );
}

function Row({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 min-h-[52px] ${!last ? "border-b border-gray-50" : ""}`}>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="text-sm text-gray-500">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { user, token, logout, setUser } = useAuth();

  const [currencies, setCurrencies] = useState<any[]>([]);
  const [currency, setCurrency] = useState(user?.home_currency ?? "USD");
  const [mode, setMode] = useState<"individual" | "business">((user?.mode as any) ?? "individual");
  const [notifFreq, setNotifFreq] = useState(user?.notification_frequency ?? "daily");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: "", ok: true });
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);

  const [tgConnected, setTgConnected] = useState(false);
  const [tgDisconnecting, setTgDisconnecting] = useState(false);
  const [tgPolling, setTgPolling] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast({ msg: "", ok: true }), 3000);
  };

  useEffect(() => {
    if (token) {
      fetch("/api/currencies", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : [])
        .then(setCurrencies)
        .catch(() => {});

      fetch("/api/telegram/status", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : { connected: false })
        .then((d) => setTgConnected(d.connected))
        .catch(() => {});
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      setCurrency(user.home_currency ?? "USD");
      setMode((user.mode as any) ?? "individual");
      setNotifFreq(user.notification_frequency ?? "daily");
    }
  }, [user]);

  const save = useCallback(async (patch: Record<string, string>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        showToast("✅ Saved");
      } else {
        showToast("❌ Could not save", false);
      }
    } catch {
      showToast("❌ Connection error", false);
    } finally {
      setSaving(false);
    }
  }, [token, setUser]);

  const handleCsvDownload = async () => {
    try {
      const res = await fetch("/api/export/csv", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { showToast("❌ Export failed", false); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "transactions.csv";
      a.click();
      URL.revokeObjectURL(url);
      showToast("✅ CSV downloaded");
    } catch {
      showToast("❌ Export failed", false);
    }
  };

  const handleRefreshRates = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/currencies/refresh", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      showToast(data.note ? `ℹ️ ${data.note}` : `✅ ${data.updated} rates updated`);
    } catch {
      showToast("❌ Could not refresh rates", false);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTestReminder = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/notifications/test", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) showToast("✅ Test reminder sent");
      else showToast("❌ Failed to send", false);
    } catch {
      showToast("❌ Connection error", false);
    } finally {
      setTesting(false);
    }
  };

  const handleActivateTelegram = () => {
    if (!user?.id) return;
    const url = `https://t.me/smartinetracker_bot?start=${user.id}`;
    window.open(url, "_blank");

    setTgPolling(true);
    let attempts = 0;
    const maxAttempts = 20;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch("/api/telegram/status", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            setTgConnected(true);
            setTgPolling(false);
            clearInterval(interval);
            showToast("✅ Telegram connected!");
            return;
          }
        }
      } catch { /* ignore */ }
      if (attempts >= maxAttempts) {
        setTgPolling(false);
        clearInterval(interval);
      }
    }, 3000);
  };

  const handleDisconnectTelegram = async () => {
    setTgDisconnecting(true);
    try {
      const res = await fetch("/api/telegram/disconnect", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setTgConnected(false);
        showToast("✅ Telegram disconnected");
      } else {
        showToast("❌ Could not disconnect", false);
      }
    } catch {
      showToast("❌ Connection error", false);
    } finally {
      setTgDisconnecting(false);
    }
  };

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <div className="flex flex-col min-h-screen pb-24" style={{ background: "#F5F6FA" }}>
      <div style={{ background: NAVY }} className="text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-white/60 text-sm mt-0.5">Manage your account & preferences</p>
      </div>

      <div className="px-4 mt-5">
        {/* Profile card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5 flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
            style={{ background: NAVY }}
          >
            {initials}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-base">{user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span
              className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: `${GREEN}20`, color: "#00A860" }}
            >
              {user?.mode}
            </span>
          </div>
        </div>

        <Section title="Preferences">
          <Row label="Home Currency">
            <select
              value={currency}
              onChange={(e) => { setCurrency(e.target.value); save({ home_currency: e.target.value }); }}
              disabled={saving}
              className="text-sm font-semibold bg-transparent border-none outline-none cursor-pointer"
              style={{ color: NAVY }}
            >
              {(currencies.length > 0 ? currencies : [{ code: "USD", name: "US Dollar" }]).map((c: any) => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>
          </Row>
          <Row label="Mode">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {(["individual", "business"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); save({ mode: m }); }}
                  className="px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all"
                  style={{
                    background: mode === m ? NAVY : "transparent",
                    color: mode === m ? "white" : "#9CA3AF",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Reminders" last>
            <select
              value={notifFreq}
              onChange={(e) => { setNotifFreq(e.target.value); save({ notification_frequency: e.target.value }); }}
              disabled={saving}
              className="text-sm font-semibold bg-transparent border-none outline-none cursor-pointer"
              style={{ color: NAVY }}
            >
              {NOTIF_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Row>
        </Section>

        <Section title="Data">
          <button onClick={handleCsvDownload} className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 active:bg-gray-50 transition-colors text-left">
            <span className="text-lg">📥</span>
            <span className="text-sm font-medium text-gray-700">Download CSV</span>
            <span className="ml-auto text-gray-400">›</span>
          </button>
          <button
            onClick={handleRefreshRates}
            disabled={refreshing}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 active:bg-gray-50 transition-colors text-left disabled:opacity-60"
          >
            <span className="text-lg">{refreshing ? "⏳" : "🔄"}</span>
            <span className="text-sm font-medium text-gray-700">Refresh Exchange Rates</span>
            <span className="ml-auto text-gray-400">›</span>
          </button>
          <button
            onClick={handleTestReminder}
            disabled={testing}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-50 transition-colors text-left disabled:opacity-60"
          >
            <span className="text-lg">{testing ? "⏳" : "🔔"}</span>
            <span className="text-sm font-medium text-gray-700">Send Test Reminder</span>
            <span className="ml-auto text-gray-400">›</span>
          </button>
        </Section>

        <Section title="Telegram Notifications">
          {tgConnected ? (
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">✅</span>
                <span className="text-sm font-semibold text-gray-800">Telegram Active — you'll get daily reminders</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">Log transactions and check your finances directly in Telegram.</p>
              <button
                onClick={handleDisconnectTelegram}
                disabled={tgDisconnecting}
                className="text-xs font-semibold transition-colors disabled:opacity-60"
                style={{ color: RED }}
              >
                {tgDisconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          ) : (
            <div className="px-4 py-4">
              <button
                onClick={handleActivateTelegram}
                disabled={tgPolling}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-70"
                style={{ background: GREEN }}
              >
                {tgPolling ? "⏳ Waiting for Telegram…" : "🔔 Activate Telegram Notifications"}
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">
                {tgPolling ? "Tap Start in Telegram, then come back here" : "Opens Telegram — just tap Start"}
              </p>
            </div>
          )}
        </Section>

        <Section title="Account">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-red-50 transition-colors"
          >
            <span className="text-lg">🚪</span>
            <span className="text-sm font-semibold" style={{ color: RED }}>Log Out</span>
          </button>
        </Section>

        <p className="text-center text-xs text-gray-400 mt-2 mb-4">Smart i-n-E Tracker · v1.0</p>
      </div>

      {/* Toast */}
      {toast.msg && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl text-sm font-semibold z-50 shadow-xl max-w-[340px] text-center text-white"
          style={{ background: toast.ok ? "#1A1A2E" : RED }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
