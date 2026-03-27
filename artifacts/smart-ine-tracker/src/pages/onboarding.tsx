import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetCurrencies, useUpdateUser } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";

const ONBOARDING_KEY = "onboarding_done";

export function isOnboardingDone() {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

export function markOnboardingDone() {
  localStorage.setItem(ONBOARDING_KEY, "true");
}

const variants = {
  enter: { x: "100%", opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: "-100%", opacity: 0 },
};

function Screen1({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
      <div className="w-24 h-24 rounded-3xl bg-[#0A1628] flex items-center justify-center mb-8 shadow-2xl">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#00D37F" />
          <path d="M2 17l10 5 10-5" stroke="#00D37F" strokeWidth="2" strokeLinecap="round" />
          <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-[#0A1628] leading-tight mb-4">
        Smart i-n-E<br />Tracker
      </h1>
      <p className="text-gray-500 text-base leading-relaxed mb-12">
        Track every naira.<br />Know your profit.
      </p>
      <button
        onClick={onNext}
        className="w-full py-4 rounded-2xl bg-[#0A1628] text-white font-bold text-lg shadow-xl active:scale-95 transition-transform"
      >
        Get Started →
      </button>
    </div>
  );
}

function Screen2({ onNext, selected, onSelect }: { onNext: () => void; selected: string; onSelect: (v: string) => void }) {
  return (
    <div className="flex flex-col flex-1 px-6 pt-12">
      <h2 className="text-2xl font-bold text-[#0A1628] mb-2">How do you use money?</h2>
      <p className="text-gray-500 text-sm mb-8">Choose your tracking mode</p>
      <div className="flex flex-col gap-4">
        {[
          {
            value: "individual",
            label: "Individual",
            desc: "Personal income, expenses & savings",
            icon: (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            ),
          },
          {
            value: "business",
            label: "Business",
            desc: "Revenue, expenses & profit margins",
            icon: (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            ),
          },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className={`flex items-center gap-5 p-5 rounded-2xl border-2 text-left transition-all active:scale-95 min-h-[80px] ${
              selected === opt.value
                ? "border-[#0A1628] bg-[#0A1628]/5"
                : "border-gray-200 bg-white"
            }`}
          >
            <span className={`${selected === opt.value ? "text-[#0A1628]" : "text-gray-400"}`}>{opt.icon}</span>
            <div>
              <p className="font-bold text-base text-[#0A1628]">{opt.label}</p>
              <p className="text-sm text-gray-500 mt-0.5">{opt.desc}</p>
            </div>
            {selected === opt.value && (
              <span className="ml-auto text-[#00D37F]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>
      <button
        onClick={onNext}
        disabled={!selected}
        className="mt-auto mb-8 w-full py-4 rounded-2xl bg-[#0A1628] text-white font-bold text-lg shadow-xl disabled:opacity-40 active:scale-95 transition-all"
      >
        Continue
      </button>
    </div>
  );
}

function Screen3({ onNext, selected, onSelect }: { onNext: () => void; selected: string; onSelect: (v: string) => void }) {
  const { token } = useAuth();
  const { data: currencies = [] } = useGetCurrencies({ query: { enabled: !!token } });
  const [search, setSearch] = useState("");

  const filtered = (currencies as any[]).filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col flex-1 px-6 pt-12 overflow-hidden">
      <h2 className="text-2xl font-bold text-[#0A1628] mb-2">Home Currency</h2>
      <p className="text-gray-500 text-sm mb-4">Used to show your totals</p>
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Search currencies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0A1628] transition-colors"
        />
      </div>
      <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-100 bg-white divide-y divide-gray-50 min-h-0">
        {filtered.slice(0, 30).map((c: any) => (
          <button
            key={c.code}
            onClick={() => onSelect(c.code)}
            className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors min-h-[52px] active:bg-gray-50 ${
              selected === c.code ? "bg-[#0A1628]/5" : ""
            }`}
          >
            <div>
              <span className="font-bold text-[#0A1628] text-sm">{c.code}</span>
              <span className="text-gray-500 text-xs ml-2">{c.name}</span>
            </div>
            {selected === c.code && (
              <span className="text-[#00D37F]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>
      <button
        onClick={onNext}
        disabled={!selected}
        className="mt-4 mb-4 w-full py-4 rounded-2xl bg-[#0A1628] text-white font-bold text-lg shadow-xl disabled:opacity-40 active:scale-95 transition-all"
      >
        Continue
      </button>
    </div>
  );
}

function Screen4({ onFinish }: { onFinish: () => void }) {
  const [notifEnabled, setNotifEnabled] = useState<boolean | null>(null);

  return (
    <div className="flex flex-col flex-1 px-6 pt-12">
      <h2 className="text-2xl font-bold text-[#0A1628] mb-2">Daily Reminders</h2>
      <p className="text-gray-500 text-sm mb-8">
        We'll remind you to log your income and expenses daily so you never lose track.
      </p>
      <div className="flex flex-col gap-4 mb-auto">
        {[
          { value: true, label: "Yes, remind me", desc: "Daily reminders at 9am", icon: "🔔" },
          { value: false, label: "No thanks", desc: "I'll log on my own", icon: "🔕" },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => setNotifEnabled(opt.value)}
            className={`flex items-center gap-5 p-5 rounded-2xl border-2 text-left transition-all active:scale-95 min-h-[80px] ${
              notifEnabled === opt.value
                ? "border-[#0A1628] bg-[#0A1628]/5"
                : "border-gray-200 bg-white"
            }`}
          >
            <span className="text-3xl">{opt.icon}</span>
            <div>
              <p className="font-bold text-base text-[#0A1628]">{opt.label}</p>
              <p className="text-sm text-gray-500">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={onFinish}
        disabled={notifEnabled === null}
        className="mt-8 mb-8 w-full py-4 rounded-2xl bg-[#00D37F] text-white font-bold text-lg shadow-xl disabled:opacity-40 active:scale-95 transition-all"
      >
        Start Tracking 🚀
      </button>
    </div>
  );
}

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("individual");
  const [currency, setCurrency] = useState("USD");
  const updateUser = useUpdateUser();

  const handleFinish = async () => {
    try {
      await updateUser.mutateAsync({ data: { mode: mode as any, home_currency: currency } });
    } catch {}
    markOnboardingDone();
    onComplete();
  };

  const screens = [
    <Screen1 onNext={() => setStep(1)} />,
    <Screen2 onNext={() => setStep(2)} selected={mode} onSelect={setMode} />,
    <Screen3 onNext={() => setStep(3)} selected={currency} onSelect={setCurrency} />,
    <Screen4 onFinish={handleFinish} />,
  ];

  return (
    <div className="absolute inset-0 bg-[#F7F8FA] z-[200] flex flex-col overflow-hidden">
      {/* Step dots */}
      <div className="flex gap-2 justify-center pt-6">
        {screens.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? "w-6 bg-[#0A1628]" : "w-1.5 bg-gray-300"
            }`}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "tween", duration: 0.25 }}
          className="flex flex-col flex-1 overflow-hidden"
        >
          {screens[step]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
