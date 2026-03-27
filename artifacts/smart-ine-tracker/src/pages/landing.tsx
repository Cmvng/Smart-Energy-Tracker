import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const NAVY = "#0A1628";
const NAVY2 = "#0d2040";
const GREEN = "#00D37F";
const VISITED_KEY = "ine_landing_v4";

export function hasVisited() {
  return localStorage.getItem(VISITED_KEY) === "true";
}

export function markVisited() {
  localStorage.setItem(VISITED_KEY, "true");
}

const features = [
  { icon: "⚡", text: "Log income or expenses in under 5 seconds" },
  { icon: "🌍", text: "Works in any currency — auto converts to USD" },
  { icon: "📊", text: "Smart insights that show if you're winning" },
];

function FakeDashboard() {
  return (
    <div
      className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
      style={{ background: "#1a2940", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Fake header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: "#0f1e33" }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md" style={{ background: GREEN }} />
          <span className="text-white text-xs font-bold">Smart i-n-E</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-400 opacity-60" />
          <div className="w-2 h-2 rounded-full bg-yellow-400 opacity-60" />
          <div className="w-2 h-2 rounded-full opacity-60" style={{ background: GREEN }} />
        </div>
      </div>

      <div className="p-4">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(0,211,127,0.12)" }}>
            <p className="text-[9px] text-white/50 mb-0.5">Income</p>
            <p className="text-xs font-bold" style={{ color: GREEN }}>$4,200</p>
          </div>
          <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,71,87,0.12)" }}>
            <p className="text-[9px] text-white/50 mb-0.5">Expenses</p>
            <p className="text-xs font-bold text-red-400">$1,850</p>
          </div>
          <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(0,211,127,0.12)" }}>
            <p className="text-[9px] text-white/50 mb-0.5">Net</p>
            <p className="text-xs font-bold" style={{ color: GREEN }}>+$2,350</p>
          </div>
        </div>

        {/* Fake transactions */}
        <div className="space-y-2 mb-4">
          {[
            { icon: "💼", label: "Freelance payment", amount: "+$1,200", color: GREEN, date: "Today" },
            { icon: "🛒", label: "Groceries", amount: "-$85", color: "#FF4757", date: "Today" },
            { icon: "💰", label: "Client invoice", amount: "+$3,000", color: GREEN, date: "Yesterday" },
          ].map((tx) => (
            <div key={tx.label} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{tx.icon}</span>
                <div>
                  <p className="text-white text-[10px] font-medium">{tx.label}</p>
                  <p className="text-white/30 text-[9px]">{tx.date}</p>
                </div>
              </div>
              <span className="text-[11px] font-bold" style={{ color: tx.color }}>{tx.amount}</span>
            </div>
          ))}
        </div>

        {/* Fake FAB */}
        <div className="flex justify-center">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
            style={{ background: GREEN, boxShadow: `0 6px 20px ${GREEN}60` }}
          >
            +
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [, navigate] = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const featRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.opacity = "0";
      requestAnimationFrame(() => {
        if (contentRef.current) {
          contentRef.current.style.transition = "opacity 0.5s ease";
          contentRef.current.style.opacity = "1";
        }
      });
    }
    featRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.opacity = "0";
      el.style.transform = "translateX(-24px)";
      setTimeout(() => {
        if (el) {
          el.style.transition = "opacity 0.4s ease, transform 0.4s ease";
          el.style.opacity = "1";
          el.style.transform = "translateX(0)";
        }
      }, 300 + i * 100);
    });
  }, []);

  const go = (path: string) => {
    markVisited();
    navigate(path);
  };

  return (
    <div className="min-h-screen flex" style={{ background: NAVY }}>
      {/* ── MOBILE / left column content ── */}
      <div className="flex-1 flex flex-col justify-between px-6 pt-14 pb-10 md:justify-center md:px-12 md:py-16 md:max-w-[52%]">
        <div ref={contentRef}>
          {/* Logo */}
          <div className="flex justify-center mb-8 md:justify-start">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl"
              style={{ background: GREEN, boxShadow: `0 16px 48px ${GREEN}55` }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" />
                <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.45" />
              </svg>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center mb-2 md:text-left">
            <h1 className="font-extrabold leading-tight" style={{ fontSize: "clamp(32px,6vw,48px)", color: "white" }}>
              Smart i-n-E
            </h1>
            <h1 className="font-extrabold leading-tight" style={{ fontSize: "clamp(32px,6vw,48px)", color: GREEN }}>
              Tracker
            </h1>
          </div>

          {/* Tagline */}
          <p className="text-center mb-10 md:text-left" style={{ color: "rgba(255,255,255,0.6)", fontSize: "16px", lineHeight: "1.55" }}>
            Track every naira. Know your profit.
          </p>

          {/* Feature rows */}
          <div className="flex flex-col gap-4 mb-10">
            {features.map((f, i) => (
              <div
                key={f.text}
                ref={(el) => { featRefs.current[i] = el; }}
                className="flex items-center gap-4"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {f.icon}
                </div>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px", lineHeight: "1.4" }}>
                  {f.text}
                </p>
              </div>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col gap-3 w-full md:max-w-[380px]">
            <button
              onClick={() => go("/register")}
              className="w-full font-bold text-white rounded-2xl transition-all active:scale-[0.98] hover:brightness-110"
              style={{
                height: "56px",
                fontSize: "16px",
                background: GREEN,
                boxShadow: `0 0 0 0 ${GREEN}80`,
                animation: "pulse-glow 2.5s ease-in-out infinite",
              }}
            >
              Get Started — It's Free →
            </button>
            <button
              onClick={() => go("/login")}
              className="w-full font-bold rounded-2xl transition-all active:scale-[0.98] hover:bg-white/10"
              style={{
                height: "52px",
                fontSize: "15px",
                color: "white",
                background: "transparent",
                border: "2px solid rgba(255,255,255,0.25)",
                animation: "pulse-border 2.5s ease-in-out infinite 0.3s",
              }}
            >
              I already have an account
            </button>
          </div>

          <p className="text-center mt-6 md:text-left" style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px" }}>
            No credit card. No setup fee. Just track.
          </p>
        </div>
      </div>

      {/* ── DESKTOP right column — fake dashboard preview ── */}
      <div
        className="hidden md:flex flex-1 items-center justify-center px-10 py-16"
        style={{ background: `linear-gradient(135deg, ${NAVY2} 0%, #0a1e36 100%)` }}
      >
        <FakeDashboard />
      </div>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 8px 30px ${GREEN}55, 0 0 0 0 ${GREEN}40; }
          50%       { box-shadow: 0 12px 40px ${GREEN}80, 0 0 0 8px ${GREEN}00; }
        }
        @keyframes pulse-border {
          0%, 100% { border-color: rgba(255,255,255,0.25); }
          50%       { border-color: rgba(255,255,255,0.5); }
        }
      `}</style>
    </div>
  );
}
