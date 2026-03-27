import { Router, Response } from "express";
import { db } from "@workspace/db";
import { transactionsTable, accountsTable } from "@workspace/db/schema";
import { eq, and, gte, isNull, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/chart", requireAuth, async (req: AuthRequest, res: Response) => {
  const days = Math.min(parseInt((req.query.days as string) || "30", 10), 90);

  try {
    const [account] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, req.userId!));

    if (!account) {
      res.status(404).json({ error: "not_found", message: "Account not found" });
      return;
    }

    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    since.setHours(0, 0, 0, 0);

    const rows = await db
      .select({
        date: sql<string>`DATE(transacted_at)`.as("date"),
        income_usd: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount_usd ELSE 0 END), 0)`.as("income_usd"),
        expense_usd: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_usd ELSE 0 END), 0)`.as("expense_usd"),
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.account_id, account.id),
          gte(transactionsTable.transacted_at, since),
          isNull(transactionsTable.deleted_at)
        )
      )
      .groupBy(sql`DATE(transacted_at)`)
      .orderBy(sql`DATE(transacted_at) ASC`);

    const dataMap = new Map(rows.map((r) => [r.date, r]));

    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const row = dataMap.get(key);
      const income = parseFloat(String(row?.income_usd ?? 0));
      const expense = parseFloat(String(row?.expense_usd ?? 0));
      result.push({
        date: key,
        income_usd: income,
        expense_usd: expense,
        net_usd: income - expense,
      });
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Analytics chart error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.get("/insights", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [account] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, req.userId!));

    if (!account) {
      res.status(404).json({ error: "not_found", message: "Account not found" });
      return;
    }

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);
    since30.setHours(0, 0, 0, 0);

    const rows = await db
      .select({
        date: sql<string>`DATE(transacted_at)`.as("date"),
        income_usd: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount_usd ELSE 0 END), 0)`.as("income_usd"),
        expense_usd: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_usd ELSE 0 END), 0)`.as("expense_usd"),
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.account_id, account.id),
          gte(transactionsTable.transacted_at, since30),
          isNull(transactionsTable.deleted_at)
        )
      )
      .groupBy(sql`DATE(transacted_at)`)
      .orderBy(sql`DATE(transacted_at) ASC`);

    const insights: Array<{ type: string; message: string; icon: string }> = [];

    if (rows.length === 0) {
      insights.push({
        type: "info",
        message: "Add some transactions to see smart insights about your finances.",
        icon: "calendar",
      });
      res.json(insights);
      return;
    }

    const totalExpense = rows.reduce((s, r) => s + parseFloat(String(r.expense_usd)), 0);
    const avgDailySpend = totalExpense / 30;
    insights.push({
      type: "spending_rate",
      message: `You spend an average of $${avgDailySpend.toFixed(2)} per day.`,
      icon: avgDailySpend > 50 ? "trend-down" : "trend-up",
    });

    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let bestDay = { date: "", net: -Infinity };
    for (const r of rows) {
      const net = parseFloat(String(r.income_usd)) - parseFloat(String(r.expense_usd));
      if (net > bestDay.net) bestDay = { date: r.date, net };
    }
    if (bestDay.date) {
      const dayName = DAYS[new Date(bestDay.date + "T12:00:00").getDay()];
      insights.push({
        type: "best_day",
        message: `Your most profitable day was ${dayName} with $${bestDay.net.toFixed(2)} net.`,
        icon: "calendar",
      });
    }

    const now = new Date();
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay());
    startOfThisWeek.setHours(0, 0, 0, 0);
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    let thisWeekNet = 0;
    let lastWeekNet = 0;
    for (const r of rows) {
      const d = new Date(r.date + "T12:00:00");
      const net = parseFloat(String(r.income_usd)) - parseFloat(String(r.expense_usd));
      if (d >= startOfThisWeek) thisWeekNet += net;
      else if (d >= startOfLastWeek) lastWeekNet += net;
    }
    const weekDiff = thisWeekNet - lastWeekNet;
    insights.push({
      type: "trend",
      message:
        weekDiff >= 0
          ? `You're up $${weekDiff.toFixed(2)} vs last week.`
          : `You're down $${Math.abs(weekDiff).toFixed(2)} vs last week.`,
      icon: weekDiff >= 0 ? "trend-up" : "trend-down",
    });

    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    let lossStreak = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const net = parseFloat(String(sorted[i].income_usd)) - parseFloat(String(sorted[i].expense_usd));
      if (net < 0) lossStreak++;
      else break;
    }
    if (lossStreak >= 3) {
      insights.push({
        type: "loss_streak",
        message: `You've been at a loss for ${lossStreak} days. Consider reviewing your expenses.`,
        icon: "alert",
      });
    }

    res.json(insights);
  } catch (err) {
    req.log.error({ err }, "Analytics insights error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

export default router;
