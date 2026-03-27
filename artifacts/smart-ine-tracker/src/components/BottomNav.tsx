import { useLocation } from "wouter";
import { useAddSheet } from "@/lib/add-sheet-context";

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const AddIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 8v8M8 12h8"/>
  </svg>
);

const ChartIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
    <line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);

const GearIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const NAV_TABS = [
  { id: "home", path: "/dashboard", label: "Home", Icon: HomeIcon, isAdd: false },
  { id: "add", path: null, label: "Add", Icon: AddIcon, isAdd: true },
  { id: "analytics", path: "/analytics", label: "Analytics", Icon: ChartIcon, isAdd: false },
  { id: "settings", path: "/settings", label: "Settings", Icon: GearIcon, isAdd: false },
];

export default function BottomNav() {
  const [location, navigate] = useLocation();
  const { openAddSheet } = useAddSheet();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 z-40 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex items-center justify-around h-[60px] px-2">
        {NAV_TABS.map(({ id, path, label, Icon, isAdd }) => {
          const isActive = path ? (location === path || (path === "/dashboard" && location === "/")) : false;

          if (isAdd) {
            return (
              <button
                key={id}
                onClick={openAddSheet}
                className="flex flex-col items-center justify-center gap-0.5 px-4 py-1 text-[#00D37F] relative -top-1"
              >
                <Icon />
                <span className="text-[10px] font-semibold tracking-wide">{label}</span>
              </button>
            );
          }

          return (
            <button
              key={id}
              onClick={() => path && navigate(path)}
              className={`flex flex-col items-center justify-center gap-0.5 px-4 py-1 transition-colors ${
                isActive ? "text-[#0A1628]" : "text-gray-400"
              }`}
            >
              <Icon />
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
              {isActive && <span className="absolute bottom-0 w-5 h-0.5 bg-[#0A1628] rounded-full" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
