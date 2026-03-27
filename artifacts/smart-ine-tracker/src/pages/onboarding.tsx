import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth";

const ONBOARDING_KEY = "ine_onboarding_done";

export function isOnboardingDone() {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

export function markOnboardingDone() {
  localStorage.setItem(ONBOARDING_KEY, "true");
}

const CURRENCIES_LIST = [
  { code: "USD", name: "US Dollar" }, { code: "EUR", name: "Euro" }, { code: "GBP", name: "British Pound" },
  { code: "NGN", name: "Nigerian Naira" }, { code: "KES", name: "Kenyan Shilling" }, { code: "GHS", name: "Ghanaian Cedi" },
  { code: "ZAR", name: "South African Rand" }, { code: "INR", name: "Indian Rupee" }, { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" }, { code: "JPY", name: "Japanese Yen" }, { code: "CNY", name: "Chinese Yuan" },
  { code: "BRL", name: "Brazilian Real" }, { code: "MXN", name: "Mexican Peso" }, { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" }, { code: "PKR", name: "Pakistani Rupee" }, { code: "EGP", name: "Egyptian Pound" },
  { code: "TZS", name: "Tanzanian Shilling" }, { code: "CHF", name: "Swiss Franc" },
];

const variants = {
  enter: { x: "100%", opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: "-100%", opacity: 0 },
};

function Screen1({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
      <div className="w-28 h-28 rounded-3xl bg-[#0A1628] flex items-center justify-center mb-8 shadow-2xl shadow-[#0A1628]/30">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#00D37F" />
          <path d="M2 17l10 5 10-5" stroke="#00D37F" strokeWidth="2" strokeLinecap="round" />
          <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-[#0A1628] leading-tight mb-3">
        Smart i-n-E<br />Tracker
      </h1>
      <p className="text-gray-500 text-base leading-relaxed mb-12">
        Track every dollar.<br />Know your profit.
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
  const opts = [
    { value: "individual", label: "Individual", desc: "Personal finances", icon: "👤" },
    { value: "business", label: "Business", desc: "Business revenue & costs", icon: "🏢" },
  ];
  return (
    <div className="flex flex-col flex-1 px-6 pt-10">
      <h2 className="text-2xl font-bold text-[#0A1628] mb-1">Choose your mode</h2>
      <p className="text-gray-500 text-sm mb-8">How do you want to track finances?</p>
      <div className="flex flex-col gap-4 flex-1">
        {opts.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className={`flex items-center gap-5 p-5 rounded-2xl border-2 text-left transition-all active:scale-95 min-h-[80px] ${
              selected === opt.value ? "border-[#00D37F] bg-[#00D37F]/5" : "border-gray-200 bg-white"
            }`}
          >
            <span className="text-3xl">{opt.icon}</span>
            <div>
              <p className="font-bold text-base text-[#0A1628]">{opt.label}</p>
              <p className="text-sm text-gray-500 mt-0.5">{opt.desc}</p>
            </div>
            {selected === opt.value && <span className="ml-auto text-[#00D37F] text-xl">✓</span>}
          </button>
        ))}
      </div>
      <button
        onClick={onNext}
        disabled={!selected}
        className="mt-6 mb-6 w-full py-4 rounded-2xl bg-[#0A1628] text-white font-bold text-lg shadow-xl disabled:opacity-40 active:scale-95 transition-all"
      >
        Continue
      </button>
    </div>
  );
}

function Screen3({ onNext, selected, onSelect }: { onNext: () => void; selected: string; onSelect: (v: string) => void }) {
  const [search, setSearch] = useState("");
  const filtered = CURRENCIES_LIST.filter(
    (c) => c.code.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="flex flex-col flex-1 px-6 pt-10 overflow-hidden">
      <h2 className="text-2xl font-bold text-[#0A1628] mb-1">Your home currency</h2>
      <p className="text-gray-500 text-sm mb-4">Used for showing your totals</p>
      <input
        type="text"
        placeholder="Search currencies..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0A1628] transition-colors mb-3"
      />
      <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-100 bg-white divide-y divide-gray-50 min-h-0">
        {filtered.map((c) => (
          <button
            key={c.code}
            onClick={() => onSelect(c.code)}
            className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors min-h-[52px] ${
              selected === c.code ? "bg-[#00D37F]/10" : "hover:bg-gray-50"
            }`}
          >
            <div>
              <span className="font-bold text-[#0A1628] text-sm">{c.code}</span>
              <span className="text-gray-500 text-xs ml-2">{c.name}</span>
            </div>
            {selected === c.code && <span className="text-[#00D37F] font-bold">✓</span>}
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

function Screen4({
  onFinish,
  mode,
  currency,
}: {
  onFinish: (notif: string) => void;
  mode: string;
  currency: string;
}) {
  const [notif, setNotif] = useState<string | null>(null);
  const opts = [
    { value: "daily", label: "Yes, remind me", desc: "Daily reminders at 9am", icon: "🔔" },
    { value: "off", label: "No thanks", desc: "I'll log on my own", icon: "🔕" },
  ];
  return (
    <div className="flex flex-col flex-1 px-6 pt-10">
      <div className="text-5xl mb-4 text-center">🎉</div>
      <h2 className="text-2xl font-bold text-[#0A1628] mb-1 text-center">You're all set!</h2>
      <div className="bg-gray-50 rounded-2xl p-4 mt-4 mb-6 text-sm text-gray-600 space-y-1">
        <p>Mode: <span className="font-bold text-[#0A1628] capitalize">{mode}</span></p>
        <p>Currency: <span className="font-bold text-[#0A1628]">{currency}</span></p>
      </div>
      <p className="text-gray-600 text-sm mb-6">Would you like daily reminders to log your finances?</p>
      <div className="flex flex-col gap-4 flex-1">
        {opts.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setNotif(opt.value)}
            className={`flex items-center gap-5 p-5 rounded-2xl border-2 text-left transition-all active:scale-95 min-h-[80px] ${
              notif === opt.value ? "border-[#00D37F] bg-[#00D37F]/5" : "border-gray-200 bg-white"
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
        onClick={() => notif && onFinish(notif)}
        disabled={!notif}
        className="mt-6 mb-6 w-full py-4 rounded-2xl bg-[#00D37F] text-white font-bold text-lg shadow-xl disabled:opacity-40 active:scale-95 transition-all"
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
  const { token } = useAuth();

  const handleFinish = async (notifFreq: string) => {
    try {
      if (token) {
        await fetch("/api/user", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode, home_currency: currency, notification_frequency: notifFreq }),
        });
      }
    } catch {}
    markOnboardingDone();
    onComplete();
  };

  const totalSteps = 4;

  return (
    <div className="absolute inset-0 bg-[#F5F6FA] z-[200] flex flex-col overflow-hidden">
      <div className="flex gap-2 justify-center pt-8 px-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? "w-8 bg-[#0A1628]" : i < step ? "w-4 bg-[#00D37F]" : "w-4 bg-gray-200"
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
          {step === 0 && <Screen1 onNext={() => setStep(1)} />}
          {step === 1 && <Screen2 onNext={() => setStep(2)} selected={mode} onSelect={setMode} />}
          {step === 2 && <Screen3 onNext={() => setStep(3)} selected={currency} onSelect={setCurrency} />}
          {step === 3 && <Screen4 onFinish={handleFinish} mode={mode} currency={currency} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
