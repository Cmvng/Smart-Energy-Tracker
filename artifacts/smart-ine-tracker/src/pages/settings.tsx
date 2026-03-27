import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useUpdateUser, useGetCurrencies, useRefreshCurrencyRates } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const NOTIFICATION_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "every_3_days", label: "Every 3 Days" },
  { value: "weekly", label: "Weekly" },
  { value: "off", label: "Off" },
];

const ChevronIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const RefreshIcon = ({ spinning }: { spinning?: boolean }) => (
  <svg
    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    style={{ animation: spinning ? "spin 1s linear infinite" : "none" }}
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
  </svg>
);

const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{title}</p>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${!last ? "border-b border-gray-50" : ""}`}>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="text-sm text-gray-500">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { user, logout, token } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [currency, setCurrency] = useState(user?.home_currency ?? "USD");
  const [mode, setMode] = useState<"individual" | "business">((user?.mode as any) ?? "individual");
  const [notifFreq, setNotifFreq] = useState((user as any)?.notification_frequency ?? "daily");
  const [saving, setSaving] = useState(false);

  const updateUser = useUpdateUser();
  const refreshRates = useRefreshCurrencyRates();
  const { data: currencies = [] } = useGetCurrencies({ query: { enabled: !!token } });

  useEffect(() => {
    if (user) {
      setCurrency(user.home_currency ?? "USD");
      setMode((user.mode as any) ?? "individual");
      setNotifFreq((user as any).notification_frequency ?? "daily");
    }
  }, [user]);

  const save = async (patch: { home_currency?: string; mode?: string; notification_frequency?: string }) => {
    setSaving(true);
    try {
      await updateUser.mutateAsync({ data: patch as any });
      toast({ title: "Saved", description: "Your settings have been updated." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not save changes." });
    } finally {
      setSaving(false);
    }
  };

  const handleCsvDownload = () => {
    const t = localStorage.getItem("token");
    const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    const url = `${BASE}/api/export/csv`;
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", "transactions.csv");
    const headers = new Headers({ Authorization: `Bearer ${t}` });
    fetch(url, { headers })
      .then((r) => r.blob())
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.click();
        URL.revokeObjectURL(objectUrl);
        toast({ title: "CSV Downloaded", description: "Your transactions have been exported." });
      })
      .catch(() => toast({ variant: "destructive", title: "Export failed", description: "Try again." }));
  };

  const handleRefreshRates = async () => {
    try {
      await refreshRates.mutateAsync({});
      toast({ title: "Rates Refreshed", description: "Exchange rates are now up to date." });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: e?.message ?? "Could not refresh rates.",
      });
    }
  };

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F8FA] pb-24">
      {/* Header */}
      <div className="bg-[#0A1628] text-white px-6 pt-12 pb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-white/60 text-sm mt-1">Manage your account & preferences</p>
      </div>

      <div className="px-4 mt-5">
        {/* Profile */}
        <Section title="Profile">
          <Row label="Name">
            <span className="text-gray-900 font-medium">{user?.name}</span>
          </Row>
          <Row label="Email" last>
            <span className="text-gray-500 text-xs">{user?.email}</span>
          </Row>
        </Section>

        {/* Preferences */}
        <Section title="Preferences">
          <Row label="Home Currency">
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                save({ home_currency: e.target.value });
              }}
              className="text-sm text-[#0A1628] font-semibold bg-transparent border-none outline-none cursor-pointer"
              disabled={saving}
            >
              {(currencies as any[]).map((c: any) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Mode" last>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {(["individual", "business"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    save({ mode: m });
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                    mode === m ? "bg-[#0A1628] text-white shadow-sm" : "text-gray-500"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Row label="Reminder Frequency" last>
            <select
              value={notifFreq}
              onChange={(e) => {
                setNotifFreq(e.target.value);
                save({ notification_frequency: e.target.value });
              }}
              className="text-sm text-[#0A1628] font-semibold bg-transparent border-none outline-none cursor-pointer"
              disabled={saving}
            >
              {NOTIFICATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        {/* Data */}
        <Section title="Data">
          <div className="border-b border-gray-50">
            <button
              onClick={handleCsvDownload}
              className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-[#00D37F]">
                  <DownloadIcon />
                </span>
                <span className="text-sm font-medium text-gray-700">Download CSV</span>
              </div>
              <ChevronIcon />
            </button>
          </div>
          <button
            onClick={handleRefreshRates}
            disabled={refreshRates.isPending}
            className="w-full flex items-center justify-between px-4 py-3.5 active:bg-gray-50 disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <span className="text-blue-500">
                <RefreshIcon spinning={refreshRates.isPending} />
              </span>
              <span className="text-sm font-medium text-gray-700">Refresh Exchange Rates</span>
            </div>
            <ChevronIcon />
          </button>
        </Section>

        {/* Account */}
        <Section title="Account">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-[#FF4757] active:bg-red-50"
          >
            <LogoutIcon />
            <span className="text-sm font-semibold">Log Out</span>
          </button>
        </Section>

        <p className="text-center text-xs text-gray-400 mt-2 mb-6">
          Smart i-n-E Tracker · v1.0
        </p>
      </div>
    </div>
  );
}
