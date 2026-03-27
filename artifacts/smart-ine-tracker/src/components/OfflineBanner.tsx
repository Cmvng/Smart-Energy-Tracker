import { useState, useEffect } from "react";

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[100] bg-amber-500 text-white text-center text-xs font-bold py-2 px-4 flex items-center justify-center gap-2 shadow-lg">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M1 6s4.5-5 11-5 11 5 11 5"/>
        <path d="M5 10s2.5-3 7-3 7 3 7 3"/>
        <path d="M9 14s1-1 3-1 3 1 3 1"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
      Offline mode — transactions will sync when reconnected
    </div>
  );
}
