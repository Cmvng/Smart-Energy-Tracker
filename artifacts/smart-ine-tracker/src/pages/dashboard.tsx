import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  LogOut, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  PieChart, 
  CreditCard,
  Settings,
  Bell
} from "lucide-react";

export default function Dashboard() {
  const { user, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <Wallet className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Not Authenticated</h2>
        <p className="text-muted-foreground mb-6">Please log in to access your dashboard.</p>
        <Link href="/login" className="w-full">
          <Button className="w-full">Go to Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      {/* App Bar */}
      <div className="bg-primary px-6 pt-12 pb-6 rounded-b-3xl shadow-md">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-primary-foreground/70 text-sm font-medium">Good Morning,</p>
            <h1 className="text-xl font-bold text-white">{user.name}</h1>
          </div>
          <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <Bell className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {/* Total Balance Card */}
        <div className="bg-gradient-to-r from-secondary to-success rounded-2xl p-6 shadow-lg shadow-secondary/20 text-white relative overflow-hidden">
          <div className="absolute right-[-10%] top-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          <p className="text-white/80 text-sm font-medium mb-1">Total Balance</p>
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-sm font-bold opacity-80">{user.home_currency}</span>
            <h2 className="text-4xl font-display font-bold">12,450.00</h2>
          </div>
          
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <ArrowUpRight className="w-3 h-3 text-white" />
              </div>
              <div>
                <p className="text-[10px] text-white/70 font-medium">Income</p>
                <p className="text-xs font-bold">+8,230</p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <ArrowDownRight className="w-3 h-3 text-white" />
              </div>
              <div>
                <p className="text-[10px] text-white/70 font-medium">Expenses</p>
                <p className="text-xs font-bold">-3,120</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pt-6 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: ArrowUpRight, label: "Income", color: "text-success", bg: "bg-success/10" },
            { icon: ArrowDownRight, label: "Expense", color: "text-destructive", bg: "bg-destructive/10" },
            { icon: PieChart, label: "Analytics", color: "text-primary", bg: "bg-primary/10" },
            { icon: CreditCard, label: "Cards", color: "text-orange-500", bg: "bg-orange-500/10" },
          ].map((action, i) => (
            <motion.button 
              key={i}
              whileTap={{ scale: 0.9 }}
              className="flex flex-col items-center gap-2"
            >
              <div className={`w-14 h-14 rounded-2xl ${action.bg} flex items-center justify-center`}>
                <action.icon className={`w-6 h-6 ${action.color}`} />
              </div>
              <span className="text-[11px] font-bold text-muted-foreground">{action.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Phase 2 Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border-2 border-dashed border-primary/20 rounded-2xl p-6 text-center"
        >
          <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-3">
            <PieChart className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">Coming in Phase 2</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Detailed transaction history, budget goals, and advanced analytics are being built.
          </p>
          <Button variant="outline" className="w-full rounded-xl">
            View Roadmap
          </Button>
        </motion.div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-6 py-4 flex justify-between items-center z-50 max-w-[430px] mx-auto">
        <button className="flex flex-col items-center gap-1 text-primary">
          <Wallet className="w-6 h-6" />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
          <PieChart className="w-6 h-6" />
          <span className="text-[10px] font-bold">Stats</span>
        </button>
        <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center -mt-8 shadow-lg shadow-primary/30 text-white cursor-pointer hover:bg-primary/90 transition-colors">
          <div className="w-6 h-px bg-white absolute"></div>
          <div className="h-6 w-px bg-white absolute"></div>
        </div>
        <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
          <Settings className="w-6 h-6" />
          <span className="text-[10px] font-bold">Settings</span>
        </button>
        <button 
          onClick={logout}
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-destructive transition-colors"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-[10px] font-bold">Logout</span>
        </button>
      </div>
    </div>
  );
}
