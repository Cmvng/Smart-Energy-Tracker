import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useCreateTransaction } from "@/hooks/use-transactions";
import { useCurrencies } from "@/hooks/use-currencies";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { 
  ArrowLeft, CheckCircle2, AlertCircle, CalendarIcon, AlignLeft, WifiOff
} from "lucide-react";
import { clsx } from "clsx";

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AddTransaction() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(user?.home_currency || "USD");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const { data: currencies } = useCurrencies();
  const createMut = useCreateTransaction();
  const { enqueue } = useOfflineQueue();

  useEffect(() => {
    if (user?.home_currency && currency === "USD") {
      setCurrency(user.home_currency);
    }
  }, [user?.home_currency]);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const handleSave = async () => {
    setErrorMsg("");
    
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setErrorMsg("Please enter a valid amount greater than 0");
      return;
    }
    
    const accountId = localStorage.getItem("account_id") || user?.id || "";
    const amountNum = Number(amount);
    const txData = {
      account_id: accountId,
      type,
      amount_original: amountNum,
      currency_code: currency,
      notes: notes.trim() || undefined,
      transacted_at: new Date(date).toISOString(),
    };

    if (isOffline) {
      enqueue(txData);
      setIsSuccess(true);
      toast({
        title: `Queued offline`,
        description: `${type === "income" ? "Income" : "Expense"} of ${fmt(amountNum, currency)} saved offline — will sync when reconnected.`,
      });
      setTimeout(() => setLocation("/dashboard"), 1200);
      return;
    }

    try {
      await createMut.mutateAsync({ data: txData });
      setIsSuccess(true);
      
      const sign = type === "income" ? "+" : "-";
      toast({
        title: type === "income" ? "Income saved 🎉" : "Expense recorded",
        description: `${sign}${fmt(amountNum, currency)} added successfully`,
      });
      
      setTimeout(() => setLocation("/dashboard"), 1200);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save transaction. Please try again.");
    }
  };

  return (
    <motion.div 
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 220 }}
      className="absolute inset-0 bg-background z-50 flex flex-col"
    >
      {/* Top Header */}
      <div className="flex items-center p-6 pb-4">
         <Link href="/dashboard" className="w-11 h-11 rounded-full bg-card text-foreground flex items-center justify-center hover:bg-accent transition-colors shadow-sm border border-border">
            <ArrowLeft className="w-5 h-5" />
         </Link>
         <h2 className="flex-1 text-center font-display font-bold text-xl mr-11">New Transaction</h2>
      </div>

      {isOffline && (
        <div className="mx-6 mb-2 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs font-semibold">
          <WifiOff className="w-4 h-4 shrink-0" />
          You're offline — transaction will be queued and synced later
        </div>
      )}

      {/* Income / Expense Toggle */}
      <div className="px-6 pb-6 pt-2">
        <div className="flex p-1.5 bg-card border border-border/60 rounded-2xl shadow-sm">
           <button 
             onClick={() => setType('income')}
             className={clsx(
               "flex-1 py-3 min-h-[44px] rounded-xl font-bold text-sm transition-all duration-300", 
               type === 'income' ? 'bg-success text-success-foreground shadow-md scale-[1.02]' : 'text-muted-foreground hover:text-foreground'
             )}
           >
             Income
           </button>
           <button 
             onClick={() => setType('expense')}
             className={clsx(
               "flex-1 py-3 min-h-[44px] rounded-xl font-bold text-sm transition-all duration-300", 
               type === 'expense' ? 'bg-destructive text-destructive-foreground shadow-md scale-[1.02]' : 'text-muted-foreground hover:text-foreground'
             )}
           >
             Expense
           </button>
        </div>
      </div>

      {/* Large Amount Input */}
      <div className="flex flex-col items-center justify-center pt-6 pb-10 flex-shrink-0">
        <div className="flex items-center justify-center text-7xl font-display font-bold text-foreground focus-within:scale-105 transition-transform duration-300">
          <input 
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, '');
              if (val.split('.').length > 2) return;
              setAmount(val);
            }}
            className={clsx(
              "bg-transparent outline-none min-w-[100px] max-w-[300px] text-center placeholder:text-muted-foreground/30",
              type === 'income' ? "text-success" : "text-foreground"
            )}
            placeholder="0"
            style={{ width: amount ? `${Math.max(amount.length, 1)}ch` : '1ch' }}
          />
        </div>
        
        {/* Currency Dropdown */}
        <div className="mt-6 flex items-center justify-center">
           <select 
             value={currency} 
             onChange={e => setCurrency(e.target.value)}
             className="bg-card border border-border/80 text-foreground px-5 py-3 rounded-full font-bold text-sm outline-none appearance-none cursor-pointer shadow-sm hover:border-primary/30 transition-colors text-center min-w-[120px] min-h-[44px]"
           >
             {currencies?.map(c => (
               <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
             ))}
             {!currencies && <option value="USD">USD</option>}
           </select>
        </div>
      </div>

      {/* Form Details Area */}
      <div className="bg-card rounded-t-[2.5rem] shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.05)] border-t border-border flex-1 flex flex-col p-6 gap-5">
        
        {errorMsg && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col gap-2 relative">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Description (Optional)</label>
          <div className="relative">
            <AlignLeft className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-background border border-border/80 pl-12 pr-4 py-3.5 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium placeholder:text-muted-foreground/50 text-foreground min-h-[44px]"
              placeholder="What was this for?"
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-2 relative">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Date & Time</label>
          <div className="relative">
            <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input 
              type="datetime-local"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-background border border-border/80 pl-12 pr-4 py-3.5 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-medium text-foreground appearance-none min-h-[44px]"
            />
          </div>
        </div>
        
        <div className="mt-auto pt-4 pb-2">
          <button 
            onClick={handleSave}
            disabled={createMut.isPending || isSuccess}
            className={clsx(
              "w-full py-4 min-h-[56px] rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 shadow-xl border",
              type === 'income' 
                ? "bg-success text-success-foreground shadow-success/25 border-success-foreground/20 hover:shadow-success/40" 
                : "bg-destructive text-destructive-foreground shadow-destructive/25 border-destructive-foreground/20 hover:shadow-destructive/40",
              (createMut.isPending || isSuccess) && "opacity-80 scale-[0.98]"
            )}
          >
            {isSuccess ? (
              <><CheckCircle2 className="w-6 h-6" /> Saved!</>
            ) : createMut.isPending ? (
              <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
            ) : isOffline ? (
              <><WifiOff className="w-5 h-5" /> Save Offline</>
            ) : (
              "Save Transaction"
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
