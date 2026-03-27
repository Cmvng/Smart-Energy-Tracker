import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTransactions, useTransactionSummary } from "@/hooks/use-transactions";
import { formatDistanceToNow } from "date-fns";
import { 
  TrendingUp, TrendingDown, Minus, Activity, Plus, Wallet,
  ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { clsx } from "clsx";

export default function Dashboard() {
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState<"day" | "week" | "month" | "year">("day");
  
  const { data: summary, isLoading: isSummaryLoading } = useTransactionSummary({ timeframe });
  const { data: listData, isLoading: isListLoading } = useTransactions({ timeframe, limit: 50 });

  const initials = user?.name 
    ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() 
    : 'U';

  const tabs = [
    { id: "day", label: "Today" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
    { id: "year", label: "Year" }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background relative pb-20">
      {/* Sticky Header & Tabs */}
      <div className="sticky top-0 z-20">
        <header className="bg-primary text-primary-foreground px-6 pt-8 pb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Wallet className="w-6 h-6 text-success" />
              <h1 className="text-xl font-display font-bold tracking-tight">Smart i-n-E</h1>
            </div>
            <div className="flex items-center gap-3">
               <span className="text-[10px] font-bold bg-white/10 px-2.5 py-1 rounded-full uppercase tracking-widest text-primary-foreground/90">
                 {user?.mode || 'User'}
               </span>
               <div className="w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-sm shadow-inner">
                 {initials}
               </div>
            </div>
          </div>
        </header>
        
        <div className="bg-primary px-6 pb-5 rounded-b-[2rem] shadow-xl shadow-primary/5 border-b border-primary-foreground/5">
          <div className="flex bg-black/20 p-1.5 rounded-2xl backdrop-blur-md">
            {tabs.map(t => (
               <button 
                 key={t.id}
                 onClick={() => setTimeframe(t.id as any)}
                 className={clsx(
                   "flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-300",
                   timeframe === t.id ? "bg-white text-primary shadow-sm scale-[1.02]" : "text-primary-foreground/70 hover:text-white"
                 )}
               >
                 {t.label}
               </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Summary Cards */}
        <div className="flex gap-4 overflow-x-auto pb-4 px-6 pt-6 -mx-6 snap-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="w-6 shrink-0" /> {/* Left padding spacer */}
          <SummaryCard title="Income" amount={summary?.total_income_usd} type="income" loading={isSummaryLoading} />
          <SummaryCard title="Expenses" amount={summary?.total_expense_usd} type="expense" loading={isSummaryLoading} />
          <SummaryCard title="Net P&L" amount={summary?.net_usd} type="net" loading={isSummaryLoading} />
          <div className="w-6 shrink-0" /> {/* Right padding spacer */}
        </div>

        {/* Insight Banner */}
        <InsightBanner summary={summary} timeframe={timeframe} loading={isSummaryLoading} />

        {/* Transactions List */}
        <div className="px-6 py-8 flex flex-col gap-4">
          <h3 className="text-lg font-bold text-foreground font-display flex items-center gap-2">
            <Activity className="w-5 h-5 text-muted-foreground" />
            Recent Transactions
          </h3>
          
          {isListLoading ? (
            Array.from({length: 5}).map((_, i) => (
              <div key={i} className="h-20 bg-card rounded-2xl animate-pulse shadow-sm border border-border/50" />
            ))
          ) : listData?.transactions?.length ? (
            <div className="flex flex-col gap-3">
              {listData.transactions.map((tx: any) => (
                <TransactionItem key={tx.id} tx={tx} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <img 
                src={`${import.meta.env.BASE_URL}images/empty-transactions.png`} 
                alt="No transactions" 
                className="w-48 h-48 object-contain opacity-90 drop-shadow-sm mb-6" 
              />
              <h4 className="text-lg font-bold text-foreground font-display">No transactions yet</h4>
              <p className="text-sm text-muted-foreground mt-2 max-w-[220px]">
                Tap the + button below to add your first transaction.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* FAB - Absolute inside the 430px relative container */}
      <Link href="/add" className="absolute bottom-6 right-6 w-14 h-14 bg-success text-success-foreground rounded-full shadow-xl shadow-success/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-30 border border-success-foreground/20">
        <Plus className="w-7 h-7" />
      </Link>
    </div>
  );
}

function SummaryCard({ title, amount, type, loading }: { title: string, amount: number | undefined, type: string, loading: boolean }) {
  const isPositive = (amount || 0) >= 0;
  
  return (
    <div className="min-w-[150px] flex-1 bg-card p-5 rounded-3xl shadow-sm border border-border/60 snap-center flex flex-col justify-between gap-3 relative overflow-hidden group hover:border-border transition-colors">
      {/* Decorative subtle background circle */}
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-transparent to-muted/30 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500" />
      
      <span className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
        {type === 'income' && <ArrowUpRight className="w-4 h-4 text-success" />}
        {type === 'expense' && <ArrowDownRight className="w-4 h-4 text-destructive" />}
        {type === 'net' && <Activity className="w-4 h-4 text-primary" />}
        {title}
      </span>
      
      {loading ? (
        <div className="h-8 bg-muted animate-pulse rounded-lg w-3/4" />
      ) : (
        <span className={clsx(
          "text-2xl font-display font-bold tracking-tight",
          type === 'income' ? "text-success" : type === 'expense' ? "text-destructive" : (isPositive ? "text-success" : "text-destructive")
        )}>
          ${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )}
    </div>
  );
}

function InsightBanner({ summary, timeframe, loading }: { summary: any, timeframe: string, loading: boolean }) {
  if (loading) return <div className="mx-6 h-14 bg-muted animate-pulse rounded-2xl" />;
  if (!summary) return null;
  
  let text = "";
  let colorClass = "";
  let Icon = Activity;
  
  const tfText = timeframe === 'day' ? 'today' : `this ${timeframe}`;
  
  if (summary.profit_status === 'profit') {
    text = `You're earning $${Number(summary.income_rate_per_hour || 0).toFixed(2)}/hr ${tfText}`;
    colorClass = "bg-success/15 text-success border-success/20";
    Icon = TrendingUp;
  } else if (summary.profit_status === 'loss') {
    text = `You're spending $${Number(summary.expense_rate_per_hour || 0).toFixed(2)}/hr ${tfText}`;
    colorClass = "bg-destructive/15 text-destructive border-destructive/20";
    Icon = TrendingDown;
  } else {
    text = `You're breaking even ${tfText}`;
    colorClass = "bg-accent text-foreground border-border";
    Icon = Minus;
  }

  return (
    <div className={clsx("mx-6 px-4 py-3.5 rounded-2xl border flex items-center gap-3 shadow-sm", colorClass)}>
      <div className="bg-background/50 p-1.5 rounded-full">
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-semibold tracking-wide">{text}</span>
    </div>
  );
}

function TransactionItem({ tx }: { tx: any }) {
  const isIncome = tx.type === 'income';
  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-2xl shadow-sm border border-border/40 hover:shadow-md hover:border-border/80 transition-all group cursor-pointer">
      <div className={clsx(
        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
        isIncome ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
      )}>
        {isIncome ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-foreground truncate text-base">
          {tx.notes || (isIncome ? 'Income' : 'Expense')}
        </h4>
        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
          {formatDistanceToNow(new Date(tx.transacted_at), { addSuffix: true })}
        </p>
      </div>
      
      <div className="text-right shrink-0">
        <p className={clsx(
          "font-bold text-base font-display",
          isIncome ? "text-success" : "text-foreground"
        )}>
          {isIncome ? '+' : '-'}{Number(tx.amount_original).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
          <span className="text-xs ml-0.5 font-sans opacity-80">{tx.currency_code}</span>
        </p>
        
        {/* Only show conversion if it's not the base currency */}
        {tx.currency_code !== 'USD' && tx.amount_usd && (
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">
            ≈ ${Number(tx.amount_usd).toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
}
