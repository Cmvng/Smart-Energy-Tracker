import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") || null;

// The frontend and API are deployed separately on Vercel and Railway. Generated
// clients use setBaseUrl; the fetch wrapper also covers the app's streaming,
// upload, and download requests without changing their response semantics.
setBaseUrl(apiBaseUrl);
if (apiBaseUrl) {
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      return nativeFetch(`${apiBaseUrl}${input}`, init);
    }
    return nativeFetch(input, init);
  };
}

setAuthTokenGetter(() => localStorage.getItem("ine_token"));

createRoot(document.getElementById("root")!).render(<App />);
