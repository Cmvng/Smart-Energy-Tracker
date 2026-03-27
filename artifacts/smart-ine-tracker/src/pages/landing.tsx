import { useLocation } from "wouter";

const NAVY = "#0A1628";
const GREEN = "#00D37F";

const VISITED_KEY = "ine_visited";

export function hasVisited() {
  return localStorage.getItem(VISITED_KEY) === "true";
}

export function markVisited() {
  localStorage.setItem(VISITED_KEY, "true");
}

const features = [
  { icon: "⚡", title: "Log in under 5 seconds", desc: "Quick entry from any screen, no friction" },
  { icon: "🌍", title: "Multi-currency", desc: "Auto USD conversion with live FX rates" },
  { icon: "📊", title: "Smart insights", desc: "Plain-English analysis that makes sense" },
];

export default function Landing() {
  const [, navigate] = useLocation();

  const go = (path: string) => {
    markVisited();
    navigate(path);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between px-6 pt-16 pb-12"
      style={{ background: `linear-gradient(160deg, ${NAVY} 60%, #0d2040 100%)` }}
    >
      {/* Top: Logo + Name */}
      <div className="flex flex-col items-center text-center max-w-md w-full">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-2xl"
          style={{ background: GREEN, boxShadow: `0 20px 60px ${GREEN}50` }}
        >
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" />
            <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.4" />
          </svg>
        </div>

        <h1 className="text-4xl font-extrabold text-white leading-tight mb-3 md:text-5xl">
          Smart i-n-E<br />Tracker
        </h1>

        <p className="text-white/70 text-base leading-relaxed mb-10 max-w-xs md:text-lg md:max-w-sm">
          Track your income and expenses in seconds.<br />
          Know your profit at a glance.
        </p>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 gap-3 w-full mb-10 md:grid-cols-3 md:gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3 rounded-2xl px-4 py-4 text-left md:flex-col md:items-center md:text-center"
              style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <span className="text-3xl shrink-0">{f.icon}</span>
              <div>
                <p className="text-white font-semibold text-sm">{f.title}</p>
                <p className="text-white/50 text-xs mt-0.5 leading-snug">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full max-w-sm md:flex-row md:max-w-md">
          <button
            onClick={() => go("/register")}
            className="flex-1 py-4 rounded-2xl font-bold text-base text-white transition-all active:scale-95 hover:brightness-110"
            style={{ background: GREEN, boxShadow: `0 8px 30px ${GREEN}50` }}
          >
            Get Started →
          </button>
          <button
            onClick={() => go("/login")}
            className="flex-1 py-4 rounded-2xl font-bold text-base transition-all active:scale-95 hover:bg-white/20"
            style={{
              background: "transparent",
              border: "2px solid rgba(255,255,255,0.4)",
              color: "white",
            }}
          >
            Sign In
          </button>
        </div>
      </div>

      {/* Footer */}
      <p className="text-white/30 text-xs mt-8">
        Smart i-n-E Tracker · Income & Expense Tracking
      </p>
    </div>
  );
}
