import { useState } from "react";
import { useGetAnalyticsChart, useGetAnalyticsInsights } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, parseISO } from "date-fns";

const TIMEFRAMES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "3 months", days: 90 },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const ICON_MAP: Record<string, string> = {
  "trend-up": "📈",
  "trend-down": "📉",
  calendar: "📅",
  alert: "⚠️",
};

const ICON_BG: Record<string, string> = {
  "trend-up": "bg-emerald-50 border-emerald-200",
  "trend-down": "bg-red-50 border-red-200",
  calendar: "bg-amber-50 border-amber-200",
  alert: "bg-red-50 border-red-200",
};

const ICON_TEXT: Record<string, string> = {
  "trend-up": "text-emerald-700",
  "trend-down": "text-red-700",
  calendar: "text-amber-700",
  alert: "text-red-700",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3 text-sm">
        <p className="text-gray-500 text-xs mb-2 font-medium">
          {label ? format(parseISO(label), "MMM d, yyyy") : ""}
        </p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
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
  const [selectedDays, setSelectedDays] = useState(30);

  const { data: chartData = [], isLoading: chartLoading } = useGetAnalyticsChart(
    { days: selectedDays },
    { query: { enabled: !!token } }
  );

  const { data: insights = [], isLoading: insightsLoading } = useGetAnalyticsInsights({
    query: { enabled: !!token },
  });

  const xTickFormatter = (val: string) => {
    try {
      const d = parseISO(val);
      return selectedDays <= 7 ? format(d, "EEE") : format(d, "MMM d");
    } catch {
      return val;
    }
  };

  const interval = selectedDays <= 7 ? 0 : selectedDays <= 30 ? 5 : 14;

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F8FA] pb-24">
      {/* Header */}
      <div className="bg-[#0A1628] text-white px-6 pt-12 pb-8">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-white/60 text-sm mt-1">Your financial overview</p>

        {/* Timeframe tabs */}
        <div className="flex gap-2 mt-5 bg-white/10 rounded-xl p-1">
          {TIMEFRAMES.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setSelectedDays(days)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                selectedDays === days
                  ? "bg-white text-[#0A1628] shadow-sm"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 -mt-2 flex flex-col gap-4">
        {/* Chart card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mt-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Income vs Expenses</h2>

          {chartLoading ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Loading chart…
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
              <span className="text-3xl">📊</span>
              <span>No data for this period</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={selectedDays <= 7 ? 20 : 8} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={xTickFormatter}
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  interval={interval}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="income_usd" name="income" fill="#00D37F" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense_usd" name="expense" fill="#FF4757" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 justify-center">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#00D37F]" />
              <span className="text-xs text-gray-500">Income</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#FF4757]" />
              <span className="text-xs text-gray-500">Expenses</span>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        {!chartLoading && chartData.length > 0 && (() => {
          const totalIncome = chartData.reduce((s, d) => s + d.income_usd, 0);
          const totalExpense = chartData.reduce((s, d) => s + d.expense_usd, 0);
          const net = totalIncome - totalExpense;
          return (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Income", value: totalIncome, color: "text-[#00D37F]" },
                { label: "Expenses", value: totalExpense, color: "text-[#FF4757]" },
                { label: "Net", value: net, color: net >= 0 ? "text-[#00D37F]" : "text-[#FF4757]" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`text-sm font-bold ${color}`}>${fmt(Math.abs(value))}</p>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Insights */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-3">Smart Insights</h2>
          {insightsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(insights as any[]).map((insight, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-4 rounded-2xl border ${
                    ICON_BG[insight.icon] ?? "bg-gray-50 border-gray-200"
                  }`}
                >
                  <span className="text-xl leading-none mt-0.5">
                    {ICON_MAP[insight.icon] ?? "💡"}
                  </span>
                  <p className={`text-sm font-medium leading-snug ${ICON_TEXT[insight.icon] ?? "text-gray-700"}`}>
                    {insight.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
