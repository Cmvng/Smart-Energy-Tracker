import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { format, parseISO } from "date-fns";

const NAVY = "#0A1628";
const GREEN = "#00D37F";
const RED = "#FF4757";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3 text-sm">
        <p className="text-gray-500 text-xs mb-2 font-medium">
          {label ? format(parseISO(label), "MMM d, yyyy") : ""}
        </p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: p.stroke || p.fill }} />
            <span className="text-gray-600 capitalize">{p.name}:</span>
            <span className="font-semibold text-gray-900">${fmt(p.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const { token } = useAuth();
  const [selectedDays, setSelectedDays] = useState(7);
  const [chartData, setChartData] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const loadChart = useCallback(async () => {
    if (!token) return;
    setChartLoading(true);
    try {
      const res = await fetch(`/api/analytics/chart?days=${selectedDays}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setChartData(await res.json());
    } catch {}
    finally { setChartLoading(false); }
  }, [token, selectedDays]);

  const loadInsights = useCallback(async () => {
    if (!token) return;
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/analytics/insights", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setInsights(await res.json());
    } catch {}
    finally { setInsightsLoading(false); }
  }, [token]);

  useEffect(() => { loadChart(); }, [loadChart]);
  useEffect(() => { loadInsights(); }, [loadInsights]);

  const xTickFmt = (val: string) => {
    try {
      const d = parseISO(val);
      return selectedDays <= 7 ? format(d, "EEE") : format(d, "MMM d");
    } catch { return val; }
  };

  const interval = selectedDays <= 7 ? 0 : selectedDays <= 30 ? 4 : 13;
  const totalIncome = chartData.reduce((s, d) => s + d.income_usd, 0);
  const totalExpense = chartData.reduce((s, d) => s + d.expense_usd, 0);
  const net = totalIncome - totalExpense;

  const toneStyle = (tone: string) => {
    if (tone === "positive") return { bar: GREEN, bg: `${GREEN}12`, text: "#00A860" };
    if (tone === "warning") return { bar: RED, bg: `${RED}12`, text: "#CC2232" };
    return { bar: "#F59E0B", bg: "#FEF3C712", text: "#92400E" };
  };

  return (
    <div className="flex flex-col min-h-screen pb-24" style={{ background: "#F5F6FA" }}>
      {/* Header - hidden on desktop since sidebar shows nav */}
      <div style={{ background: NAVY }} className="text-white px-5 pt-12 pb-6 md:pt-8">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-white/60 text-sm mt-0.5">Your financial overview</p>
        <div className="flex gap-2 mt-4 bg-white/10 rounded-xl p-1 max-w-xs">
          {[{ label: "7 days", days: 7 }, { label: "30 days", days: 30 }].map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setSelectedDays(days)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                selectedDays === days ? "bg-white text-[#0A1628] shadow-sm" : "text-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 flex flex-col gap-4 mt-4 md:px-8 md:max-w-[1100px] md:w-full md:mx-auto md:mt-6">
        {/* Stats row */}
        {!chartLoading && chartData.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Income", value: totalIncome, color: GREEN },
              { label: "Expenses", value: totalExpense, color: RED },
              { label: "Net P&L", value: net, color: net >= 0 ? GREEN : RED },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-base font-bold md:text-xl" style={{ color }}>${fmt(Math.abs(value))}</p>
              </div>
            ))}
          </div>
        )}

        {/* Bar Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 md:text-base md:mb-4">Income vs Expenses</h2>
          {chartLoading ? (
            <div className="h-48 md:h-[400px] flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: GREEN, borderTopColor: "transparent" }} />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-48 md:h-[400px] flex flex-col items-center justify-center text-gray-400 gap-2">
              <span className="text-4xl">📊</span>
              <span className="text-sm">Not enough data yet — keep tracking!</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={typeof window !== "undefined" && window.innerWidth >= 768 ? 400 : 200}>
              <BarChart data={chartData} barSize={selectedDays <= 7 ? 24 : 10} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis dataKey="date" tickFormatter={xTickFmt} tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} interval={interval} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={42} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="income_usd" name="income" fill={GREEN} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense_usd" name="expense" fill={RED} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex items-center gap-4 mt-3 justify-center">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: GREEN }} /><span className="text-xs text-gray-500">Income</span></div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: RED }} /><span className="text-xs text-gray-500">Expenses</span></div>
          </div>
        </div>

        {/* Net P&L Line Chart */}
        {!chartLoading && chartData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 md:text-base md:mb-4">Net P&L Trend</h2>
            <ResponsiveContainer width="100%" height={typeof window !== "undefined" && window.innerWidth >= 768 ? 400 : 140}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis dataKey="date" tickFormatter={xTickFmt} tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} interval={interval} />
                <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={42} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="net_usd"
                  name="net"
                  stroke={net >= 0 ? GREEN : RED}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Insights */}
        <div className="md:pb-8">
          <h2 className="text-base font-bold mb-3" style={{ color: NAVY }}>Smart Insights</h2>
          {insightsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : insights.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Not enough data yet — keep tracking!</div>
          ) : (
            <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
              {insights.map((insight: any, i) => {
                const s = toneStyle(insight.tone);
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-4 rounded-2xl border"
                    style={{ background: s.bg, borderColor: `${s.bar}30` }}
                  >
                    <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: s.bar }} />
                    <p className="text-sm font-medium leading-snug" style={{ color: s.text }}>{insight.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
