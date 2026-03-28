import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

const NAVY = "#0A1628";
const GREEN = "#00D37F";
const RED = "#FF4757";
const AMBER = "#FFB800";

interface ParsedTx {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  currency: string;
  confidence: "high" | "medium" | "low";
}

interface ReviewTx extends ParsedTx {
  selected: boolean;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Spinner() {
  return (
    <div className="w-8 h-8 border-4 border-[#00D37F] border-t-transparent rounded-full animate-spin mx-auto" />
  );
}

export default function Import() {
  const { token } = useAuth();
  const [, navigate] = useLocation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "scanning" | "review" | "importing" | "success" | "error">("idle");
  const [scanMsg, setScanMsg] = useState("Reading your document...");
  const [errorMsg, setErrorMsg] = useState("");

  const [importId, setImportId] = useState("");
  const [filename, setFilename] = useState("");
  const [txList, setTxList] = useState<ReviewTx[]>([]);

  const [successData, setSuccessData] = useState<{ imported: number; income: number; expense: number; net: number } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const scanMessages = ["Reading your document...", "Finding transactions...", "Almost done..."];
  const scanMsgRef = useRef(0);

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/documents/history", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setHistory(await res.json());
    } catch {}
  }, [token]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    if (stage !== "scanning") return;
    const iv = setInterval(() => {
      scanMsgRef.current = (scanMsgRef.current + 1) % scanMessages.length;
      setScanMsg(scanMessages[scanMsgRef.current]);
    }, 2000);
    return () => clearInterval(iv);
  }, [stage]);

  const handleFile = (f: File) => {
    const lc = f.name.toLowerCase();
    if (!lc.endsWith(".pdf") && !lc.endsWith(".csv")) {
      setErrorMsg("Only PDF and CSV files are supported right now.");
      setStage("error");
      return;
    }
    setFile(f);
    setStage("idle");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleScan = async () => {
    if (!file || !token) return;
    setStage("scanning");
    scanMsgRef.current = 0;
    setScanMsg("Reading your document...");

    const formData = new FormData();
    formData.append("document", file);
    try {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(friendlyError(data.error || "Could not read this file."));
        setStage("error");
        return;
      }
      setImportId(data.import_id);
      setFilename(data.filename);
      const defaultSelected = (tx: ParsedTx) => tx.confidence !== "low";
      setTxList(data.transactions.map((tx: ParsedTx) => ({ ...tx, selected: defaultSelected(tx) })));
      setStage("review");
    } catch {
      setErrorMsg("Connection error. Please try again.");
      setStage("error");
    }
  };

  const handleConfirm = async () => {
    const selected = txList.filter((t) => t.selected);
    if (selected.length === 0) return;
    setStage("importing");
    try {
      const res = await fetch("/api/documents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ import_id: importId, transactions: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Import failed.");
        setStage("error");
        return;
      }
      setSuccessData({
        imported: data.imported,
        income: data.summary.total_income_usd,
        expense: data.summary.total_expense_usd,
        net: data.summary.net_usd,
      });
      setStage("success");
      fetchHistory();
    } catch {
      setErrorMsg("Connection error. Please try again.");
      setStage("error");
    }
  };

  const handleDeleteImport = async (id: string) => {
    if (!window.confirm("Delete this import and all its transactions?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      fetchHistory();
    } catch {}
    setDeletingId(null);
  };

  const reset = () => {
    setFile(null); setStage("idle"); setTxList([]); setImportId(""); setFilename(""); setErrorMsg(""); setSuccessData(null);
  };

  const selectedCount = txList.filter((t) => t.selected).length;
  const selectedIncome = txList.filter((t) => t.selected && t.type === "income").reduce((s, t) => s + t.amount, 0);
  const selectedExpense = txList.filter((t) => t.selected && t.type === "expense").reduce((s, t) => s + t.amount, 0);

  function friendlyError(msg: string) {
    if (msg.toLowerCase().includes("image") || msg.toLowerCase().includes("scan")) {
      return "This PDF appears to be scanned or image-based. Try exporting as CSV from your bank's app instead. Most banks offer a 'Download transactions' or 'Export to CSV' option.";
    }
    if (msg.toLowerCase().includes("csv") || msg.toLowerCase().includes("column") || msg.toLowerCase().includes("parse")) {
      return "We couldn't read the column structure. Make sure it has headers like Date, Description, Amount. Try downloading directly from your bank.";
    }
    if (msg.toLowerCase().includes("large") || msg.toLowerCase().includes("10mb")) {
      return "File is too large. Maximum size is 10MB. Try exporting a shorter date range.";
    }
    if (msg.toLowerCase().includes("type") || msg.toLowerCase().includes("supported")) {
      return "Only PDF and CSV files are supported right now.";
    }
    return msg;
  }

  if (stage === "success" && successData) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center px-6 pb-24" style={{ background: "#F5F6FA" }}>
        <div className="text-7xl mb-6 animate-bounce">✅</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: NAVY }}>Successfully imported!</h2>
        <p className="text-gray-500 mb-6 text-center">{successData.imported} transaction{successData.imported !== 1 ? "s" : ""} added to your history</p>
        <div className="w-full max-w-sm bg-white rounded-2xl p-4 mb-6 shadow-sm border border-gray-100">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Income</span>
            <span className="font-semibold" style={{ color: GREEN }}>${fmt(successData.income)}</span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Expenses</span>
            <span className="font-semibold" style={{ color: RED }}>${fmt(successData.expense)}</span>
          </div>
          <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-bold">
            <span>Net</span>
            <span style={{ color: successData.net >= 0 ? GREEN : RED }}>${fmt(Math.abs(successData.net))}</span>
          </div>
        </div>
        <button onClick={() => navigate("/dashboard")} className="w-full max-w-sm h-[52px] rounded-[26px] font-bold text-white mb-3" style={{ background: GREEN }}>
          View Dashboard →
        </button>
        <button onClick={reset} className="w-full max-w-sm h-[52px] rounded-[26px] font-bold border-2" style={{ borderColor: NAVY, color: NAVY }}>
          Import Another
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-24" style={{ background: "#F5F6FA" }}>
      {/* Header */}
      <div className="text-white px-5 pt-12 pb-6" style={{ background: NAVY }}>
        <h1 className="text-2xl font-bold tracking-tight">Import Transactions</h1>
        <p className="text-white/60 text-sm mt-0.5">Upload your bank statement or CSV</p>
      </div>

      <div className="flex-1 px-4 pt-4">

        {stage === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 text-red-700 text-sm">
            {errorMsg}
            <button onClick={reset} className="mt-2 text-xs font-bold underline block">Try again</button>
          </div>
        )}

        {/* Upload Box */}
        {(stage === "idle" || stage === "error") && (
          <>
            <div
              className="relative w-full rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer mb-4"
              style={{ minHeight: 180, border: `2px dashed rgba(0,211,127,0.5)`, background: "rgba(0,211,127,0.05)" }}
              onClick={() => !file && fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {file ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setStage("idle"); }}
                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm hover:bg-gray-300"
                  >✕</button>
                  <div className="text-3xl">📄</div>
                  <p className="font-bold text-sm text-center px-4" style={{ color: GREEN }}>{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                </>
              ) : (
                <>
                  <div className="text-5xl">📂</div>
                  <p className="font-bold text-base" style={{ color: NAVY }}>Tap to upload your bank statement</p>
                  <p className="text-sm text-gray-400">PDF or CSV — up to 10MB</p>
                </>
              )}
            </div>

            <input ref={fileInputRef} type="file" accept=".pdf,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

            {file && (
              <button
                onClick={handleScan}
                className="w-full h-[52px] rounded-[26px] font-bold text-white mb-4 transition-all active:scale-95"
                style={{ background: GREEN }}
              >
                Scan Document →
              </button>
            )}

            {/* Format cards */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[
                { icon: "📄", title: "Bank Statement PDF", desc: "Exported from your bank's app" },
                { icon: "📊", title: "CSV Export", desc: "Downloaded transaction history" },
                { icon: "🔜", title: "Receipt Images", desc: "Coming soon — premium" },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="bg-white rounded-xl p-3 text-center border border-gray-100 shadow-sm">
                  <div className="text-2xl mb-1">{icon}</div>
                  <p className="text-xs font-bold text-gray-700 leading-tight mb-1">{title}</p>
                  <p className="text-xs text-gray-400 leading-tight">{desc}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Scanning state */}
        {stage === "scanning" && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Spinner />
            <p className="text-gray-500 text-sm font-medium">{scanMsg}</p>
          </div>
        )}

        {/* Importing state */}
        {stage === "importing" && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Spinner />
            <p className="text-gray-500 text-sm font-medium">Saving {selectedCount} transactions...</p>
          </div>
        )}

        {/* Review state */}
        {stage === "review" && (
          <>
            <div className="rounded-xl p-3 mb-4 text-sm font-medium" style={{ background: "rgba(0,211,127,0.12)", color: "#007a4a" }}>
              ✅ Found <strong>{txList.length}</strong> transactions in <strong>{filename}</strong>
              <div className="text-xs mt-0.5 font-normal" style={{ color: "#007a4a" }}>Review and select which ones to import</div>
            </div>

            <div className="flex gap-2 mb-3">
              <button onClick={() => setTxList((l) => l.map((t) => ({ ...t, selected: true })))}
                className="text-xs px-3 py-1.5 rounded-lg border font-semibold" style={{ borderColor: GREEN, color: GREEN }}>
                Select all
              </button>
              <button onClick={() => setTxList((l) => l.map((t) => ({ ...t, selected: false })))}
                className="text-xs px-3 py-1.5 rounded-lg border font-semibold text-gray-500 border-gray-300">
                Deselect all
              </button>
            </div>

            <div className="space-y-2 mb-40">
              {txList.map((tx, i) => (
                <div
                  key={i}
                  onClick={() => setTxList((l) => l.map((t, j) => j === i ? { ...t, selected: !t.selected } : t))}
                  className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-start gap-3 cursor-pointer active:opacity-70"
                  style={{ opacity: tx.selected ? 1 : 0.55 }}
                >
                  <input type="checkbox" checked={tx.selected} readOnly
                    className="mt-0.5 w-5 h-5 rounded accent-[#00D37F] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs text-gray-400">{tx.date}</span>
                      <span className="font-bold text-sm" style={{ color: tx.type === "income" ? GREEN : RED }}>
                        {tx.type === "income" ? "+" : "-"}${fmt(tx.amount)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTxList((l) => l.map((t, j) => j === i ? { ...t, type: t.type === "income" ? "expense" : "income" } : t));
                        }}
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          background: tx.type === "income" ? "rgba(0,211,127,0.15)" : "rgba(255,71,87,0.12)",
                          color: tx.type === "income" ? "#007a4a" : RED,
                        }}
                      >
                        {tx.type === "income" ? "💰 Income" : "💸 Expense"}
                      </button>
                      {tx.confidence === "medium" && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(255,184,0,0.15)", color: "#996d00" }}>⚠️ Review</span>
                      )}
                      {tx.confidence === "low" && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(255,71,87,0.12)", color: RED }}>❓ Check</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Import History */}
        {(stage === "idle" || stage === "error") && (
          <div className="mb-4">
            <button
              onClick={() => setHistoryOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-bold mb-2"
              style={{ color: NAVY }}
            >
              Previous imports <span>{historyOpen ? "▲" : "▼"}</span>
            </button>
            {historyOpen && (
              history.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No imports yet</p>
              ) : (
                <div className="space-y-2">
                  {history.map((imp) => (
                    <div key={imp.id} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-center gap-3">
                      <span className="text-xl">{imp.file_type === "pdf" ? "📄" : "📊"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{imp.filename}</p>
                        <p className="text-xs text-gray-400">{new Date(imp.created_at).toLocaleDateString()}</p>
                        {imp.status === "completed" && (
                          <p className="text-xs font-semibold" style={{ color: GREEN }}>{imp.total_imported} transactions imported</p>
                        )}
                        {imp.status === "failed" && (
                          <p className="text-xs font-semibold" style={{ color: RED }}>Import failed</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteImport(imp.id)}
                        disabled={deletingId === imp.id}
                        className="text-gray-300 hover:text-red-400 transition-colors text-xl"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Sticky review summary */}
      {stage === "review" && (
        <div className="fixed bottom-[60px] left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 px-4 py-3 z-30 shadow-lg">
          <div className="text-xs text-gray-500 mb-2 flex gap-3">
            <span><strong>{selectedCount}</strong> selected</span>
            <span style={{ color: GREEN }}>💚 ${fmt(selectedIncome)}</span>
            <span style={{ color: RED }}>❤️ ${fmt(selectedExpense)}</span>
            <span>Net: <strong style={{ color: selectedIncome - selectedExpense >= 0 ? GREEN : RED }}>${fmt(Math.abs(selectedIncome - selectedExpense))}</strong></span>
          </div>
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="w-full h-[48px] rounded-[24px] font-bold text-white transition-all active:scale-95"
            style={{ background: selectedCount > 0 ? GREEN : "#ccc" }}
          >
            Import {selectedCount} Transaction{selectedCount !== 1 ? "s" : ""} →
          </button>
        </div>
      )}
    </div>
  );
}
