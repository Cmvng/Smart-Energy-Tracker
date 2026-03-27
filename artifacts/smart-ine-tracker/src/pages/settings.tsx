import { useState, useEffect, useCallback, useRef } from "react";
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

const NOTIF_DESCRIPTIONS: Record<string, string> = {
  daily: "You'll get a morning and evening check-in daily",
  every_3_days: "Check-ins on Monday, Wednesday & Friday",
  weekly: "One check-in every Sunday",
  off: "No reminders will be sent",
};

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currencies, setCurrencies] = useState<any[]>([]);
  const [currency, setCurrency] = useState(user?.home_currency ?? "USD");
  const [mode, setMode] = useState<"individual" | "business">((user?.mode as any) ?? "individual");
  const [notifFreq, setNotifFreq] = useState(user?.notification_frequency ?? "daily");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: "", ok: true });
  const [refreshing, setRefreshing] = useState(false);
  const [profileName, setProfileName] = useState(user?.name ?? "");
  const [profileNickname, setProfileNickname] = useState(user?.nickname ? "@" + user.nickname : "");
  const [savingProfile, setSavingProfile] = useState(false);

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
      setProfileName(user.name ?? "");
      setProfileNickname(user.nickname ? "@" + user.nickname : "");
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
        showToast("✅ Reminder preference saved!");
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

  const handleActivateTelegram = () => {
    if (!user?.id) return;
    window.open(`https://t.me/smartinetracker_bot?start=${user.id}`, "_blank");

    setTgPolling(true);
    let attempts = 0;
    const maxAttempts = 30;
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
    }, 2000);
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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("❌ Image too large. Max 5MB");
      return;
    }
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const res = await fetch("/api/user/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        localStorage.setItem("ine_user", JSON.stringify(data.user));
        showToast("✅ Profile photo updated!");
      } else {
        showToast("❌ Upload failed", false);
      }
    } catch {
      showToast("❌ Upload failed", false);
    }
    e.target.value = "";
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: profileName.trim() || undefined,
          nickname: profileNickname.replace(/^@/, ""),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        showToast("✅ Profile updated!");
      } else {
        showToast("❌ Could not save", false);
      }
    } catch {
      showToast("❌ Connection error", false);
    } finally {
      setSavingProfile(false);
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
        {/* Profile card with avatar upload */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
          <div
            style={{ position: "relative", width: 90, height: 90, margin: "0 auto 16px", cursor: "pointer" }}
            onClick={() => fileInputRef.current?.click()}
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="Profile"
                style={{ width: 90, height: 90, borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div style={{
                width: 90, height: 90, borderRadius: "50%", background: NAVY,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontSize: 28, fontWeight: 600,
              }}>
                {initials}
              </div>
            )}
            <div style={{
              position: "absolute", bottom: 0, right: 0, width: 28, height: 28,
              borderRadius: "50%", background: GREEN, display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 14,
            }}>
              📷
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 20, color: NAVY }}>{user?.name}</div>
            {user?.nickname ? (
              <div style={{ color: GREEN, fontSize: 15, marginTop: 4 }}>@{user.nickname}</div>
            ) : (
              <div
                style={{ color: "#9CA3AF", fontSize: 14, marginTop: 4, cursor: "pointer" }}
                onClick={() => {
                  const el = document.getElementById("nickname-input");
                  el?.focus();
                }}
              >
                Add a nickname →
              </div>
            )}
            <div style={{ color: "#888", fontSize: 13, marginTop: 4 }}>{user?.email}</div>
            <span
              className="inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{ background: `${GREEN}20`, color: "#00A860" }}
            >
              {user?.mode}
            </span>
          </div>

          {/* Editable fields */}
          <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Display Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Your name"
                style={{ width: "100%", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 6 }}>Nickname</label>
              <input
                id="nickname-input"
                type="text"
                value={profileNickname}
                onChange={(e) => {
                  const v = e.target.value;
                  const stripped = v.replace(/^@+/, "");
                  setProfileNickname(stripped ? "@" + stripped : "");
                }}
                placeholder="@moneyking"
                style={{ width: "100%", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              style={{ width: "100%", background: GREEN, color: "white", border: "none", borderRadius: 14, padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: savingProfile ? 0.6 : 1, minHeight: 44 }}
            >
              {savingProfile ? "Saving..." : "Save Changes"}
            </button>
          </div>

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleAvatarChange}
          />
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
          <Row label="Mode" last>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {(["individual", "business"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); save({ mode: m }); }}
                  className="px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all min-h-[44px]"
                  style={{ background: mode === m ? NAVY : "transparent", color: mode === m ? "white" : "#9CA3AF" }}
                >
                  {m}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        {/* Reminder Frequency — controls email + Telegram */}
        <div className="mb-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Reminder Frequency</p>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reminder Frequency</label>
              <select
                value={notifFreq}
                onChange={(e) => {
                  setNotifFreq(e.target.value);
                  save({ notification_frequency: e.target.value });
                }}
                disabled={saving}
                className="w-full text-sm font-semibold rounded-xl border border-gray-200 px-3 py-2.5 outline-none cursor-pointer"
                style={{ color: NAVY, fontSize: 16, minHeight: 44 }}
              >
                {NOTIF_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-2">
                {NOTIF_DESCRIPTIONS[notifFreq] ?? ""}
              </p>
              <p className="text-xs text-gray-400 mt-1">This setting controls both Telegram and email reminders</p>
            </div>
          </div>
        </div>

        <Section title="Data">
          <button onClick={handleCsvDownload} className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 active:bg-gray-50 transition-colors text-left min-h-[52px]">
            <span className="text-lg">📥</span>
            <span className="text-sm font-medium text-gray-700">Download CSV</span>
            <span className="ml-auto text-gray-400">›</span>
          </button>
          <button
            onClick={handleRefreshRates}
            disabled={refreshing}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-50 transition-colors text-left disabled:opacity-60 min-h-[52px]"
          >
            <span className="text-lg">{refreshing ? "⏳" : "🔄"}</span>
            <span className="text-sm font-medium text-gray-700">Refresh Exchange Rates</span>
            <span className="ml-auto text-gray-400">›</span>
          </button>
        </Section>

        {/* Telegram Reminders */}
        <div className="mb-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Telegram Reminders</p>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {tgConnected ? (
              <div className="px-4 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">✅</span>
                  <span className="text-sm font-semibold text-gray-800">Telegram Reminders Active</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">Reminders sent based on your frequency setting</p>
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
                <p className="text-sm text-gray-600 mb-4">
                  Get fun daily check-ins on Telegram. Just tap the button and press Start — that's it!
                </p>
                <button
                  onClick={handleActivateTelegram}
                  disabled={tgPolling}
                  style={{
                    width: "100%", height: 52, borderRadius: 26,
                    background: tgPolling ? "#9CA3AF" : GREEN,
                    color: "white", fontSize: 15, fontWeight: 700,
                    border: "none", cursor: tgPolling ? "default" : "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  {tgPolling ? "⏳ Waiting for Telegram…" : "🔔 Setup Telegram Reminders"}
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">
                  {tgPolling ? "Tap Start in Telegram, then come back here" : "Opens Telegram — just tap Start"}
                </p>
              </div>
            )}
          </div>
        </div>

        <Section title="Account">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-red-50 transition-colors min-h-[52px]"
          >
            <span className="text-lg">🚪</span>
            <span className="text-sm font-semibold" style={{ color: RED }}>Log Out</span>
          </button>
        </Section>

        <p className="text-center text-xs text-gray-400 mt-2 mb-4">Smart i-n-E Tracker · v1.0</p>
      </div>

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
