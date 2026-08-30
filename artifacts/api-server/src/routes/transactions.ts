import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable, accountsTable, currenciesTable } from "@workspace/db/schema";
import { eq, and, gte, isNull, sql, sum, count, desc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { Response } from "express";

const router: IRouter = Router();

function getTimeframeStart(timeframe: string): Date {
  const now = new Date();
  switch (timeframe) {
    case "day":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    case "year":
      return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    default:
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }
}

function getElapsedHours(timeframe: string): number {
  const start = getTimeframeStart(timeframe);
  const now = new Date();
  const ms = now.getTime() - start.getTime();
  return Math.max(ms / (1000 * 60 * 60), 0.0167);
}

function buildInsightMessage(
  timeframe: string,
  totalIncomeUsd: number,
  totalExpenseUsd: number,
  netUsd: number,
  expenseRatePerHour: number,
  profitStatus: string
): string {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (totalIncomeUsd === 0 && totalExpenseUsd === 0) {
    return "No transactions yet — tap + to get started";
  }
  if (profitStatus === "profit") {
    const label =
      timeframe === "day" ? "today" : timeframe === "week" ? "this week" : timeframe === "month" ? "this month" : "this year";
    return `You're up $${fmt(netUsd)} ${label} 🎉`;
  }
  if (profitStatus === "loss") {
    if (expenseRatePerHour > 0.01) {
      return `You're spending $${fmt(expenseRatePerHour)}/hour — review your expenses`;
    }
    return `Net loss of $${fmt(Math.abs(netUsd))} — time to cut costs`;
  }
  return `Breaking even at $${fmt(totalExpenseUsd)} spent`;
}

router.get("/summary", requireAuth, async (req: AuthRequest, res: Response) => {
  const timeframe = (req.query.timeframe as string) || "day";
  const fromParam = req.query.from as string | undefined;
  const toParam = req.query.to as string | undefined;

  const isCustomRange = !!(fromParam && toParam);
  let periodStart: Date;
  let periodEnd: Date | null = null;

  if (isCustomRange) {
    periodStart = new Date(fromParam + "T00:00:00.000Z");
    periodEnd = new Date(toParam + "T23:59:59.999Z");
  } else {
    periodStart = getTimeframeStart(timeframe);
  }

  try {
    const userAccounts = await db
      .select({ id: accountsTable.id })
      .from(accountsTable)
      .where(eq(accountsTable.user_id, req.userId!));

    if (userAccounts.length === 0) {
      res.json({
        total_income_usd: 0, total_expense_usd: 0, net_usd: 0,
        transaction_count: 0, income_rate_per_hour: 0, expense_rate_per_hour: 0,
        profit_status: "breakeven",
        insight_message: "No transactions yet — tap + to get started",
        timeframe,
      });
      return;
    }

    const accountIds = userAccounts.map((a) => a.id);
    const idArr = sql`ARRAY[${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)}]::text[]`;

    const whereConditions = [
      sql`${transactionsTable.account_id} = ANY(${idArr})`,
      gte(transactionsTable.transacted_at, periodStart),
      isNull(transactionsTable.deleted_at),
    ];
    if (periodEnd) {
      whereConditions.push(sql`${transactionsTable.transacted_at} <= ${periodEnd}`);
    }

    const rows = await db
      .select({ type: transactionsTable.type, total: sum(transactionsTable.amount_usd), cnt: count() })
      .from(transactionsTable)
      .where(and(...whereConditions))
      .groupBy(transactionsTable.type);

    let totalIncomeUsd = 0, totalExpenseUsd = 0, totalCount = 0;
    for (const row of rows) {
      const val = parseFloat(row.total ?? "0");
      const c = Number(row.cnt ?? 0);
      if (row.type === "income") { totalIncomeUsd = val; totalCount += c; }
      else if (row.type === "expense") { totalExpenseUsd = val; totalCount += c; }
    }

    const netUsd = totalIncomeUsd - totalExpenseUsd;
    const elapsedHours = getElapsedHours(timeframe);
    const incomeRatePerHour = totalIncomeUsd / elapsedHours;
    const expenseRatePerHour = totalExpenseUsd / elapsedHours;
    const profitStatus = netUsd > 0.005 ? "profit" : netUsd < -0.005 ? "loss" : "breakeven";
    const insightMessage = buildInsightMessage(timeframe, totalIncomeUsd, totalExpenseUsd, netUsd, expenseRatePerHour, profitStatus);

    const daysInRange = isCustomRange
      ? Math.max(1, Math.ceil((periodEnd!.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)))
      : null;
    const dailyAvg = daysInRange ? Math.round((netUsd / daysInRange) * 100) / 100 : null;

    res.json({
      total_income_usd: Math.round(totalIncomeUsd * 100) / 100,
      total_expense_usd: Math.round(totalExpenseUsd * 100) / 100,
      net_usd: Math.round(netUsd * 100) / 100,
      transaction_count: totalCount,
      income_rate_per_hour: Math.round(incomeRatePerHour * 100) / 100,
      expense_rate_per_hour: Math.round(expenseRatePerHour * 100) / 100,
      profit_status: profitStatus,
      insight_message: insightMessage,
      timeframe,
      ...(isCustomRange && {
        daily_avg: dailyAvg,
        days_in_range: daysInRange,
        from_date: fromParam,
        to_date: toParam,
      }),
    });
  } catch (err) {
    req.log.error({ err }, "Get summary error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const timeframe = (req.query.timeframe as string) || "month";
  const fromParam = req.query.from as string | undefined;
  const toParam = req.query.to as string | undefined;
  const typeFilter = req.query.type as string | undefined;
  const search = req.query.search as string | undefined;
  const sortParam = req.query.sort as string | undefined;
  const offsetParam = parseInt(req.query.offset as string || "0", 10);
  const limitParam = parseInt(req.query.limit as string || "0", 10);

  const useCustomRange = !!(fromParam || toParam);
  const periodStart = useCustomRange ? (fromParam ? new Date(fromParam) : new Date(0)) : getTimeframeStart(timeframe);
  const periodEnd = useCustomRange && toParam ? new Date(toParam + "T23:59:59.999Z") : null;

  try {
    const userAccounts = await db
      .select({ id: accountsTable.id })
      .from(accountsTable)
      .where(eq(accountsTable.user_id, req.userId!));

    if (userAccounts.length === 0) {
      res.json(limitParam > 0 ? { transactions: [], total: 0 } : []);
      return;
    }

    const accountIds = userAccounts.map((a) => a.id);
    const idArr = sql`ARRAY[${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)}]::text[]`;

    const conditions = [
      sql`${transactionsTable.account_id} = ANY(${idArr})`,
      gte(transactionsTable.transacted_at, periodStart),
      isNull(transactionsTable.deleted_at),
    ];
    if (periodEnd) conditions.push(sql`${transactionsTable.transacted_at} <= ${periodEnd}`);
    if (typeFilter && (typeFilter === "income" || typeFilter === "expense")) {
      conditions.push(eq(transactionsTable.type, typeFilter));
    }
    if (search) {
      conditions.push(sql`LOWER(${transactionsTable.notes}) LIKE ${`%${search.toLowerCase()}%`}`);
    }

    let orderBy;
    if (sortParam === "oldest") orderBy = transactionsTable.transacted_at;
    else if (sortParam === "largest") orderBy = sql`${transactionsTable.amount_usd}::numeric DESC`;
    else orderBy = desc(transactionsTable.transacted_at);

    if (limitParam > 0) {
      const [{ total }] = await db.select({ total: count() }).from(transactionsTable).where(and(...conditions));
      const rows = await db.select().from(transactionsTable).where(and(...conditions))
        .orderBy(orderBy as any).offset(offsetParam).limit(limitParam);
      res.json({ transactions: rows, total });
      return;
    }

    const transactions = await db.select().from(transactionsTable)
      .where(and(...conditions)).orderBy(orderBy as any);
    res.json(transactions);
  } catch (err) {
    req.log.error({ err }, "List transactions error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const { type, amount_original, currency_code, notes, transacted_at } = req.body;

  if (!type || !amount_original || !currency_code) {
    res.status(400).json({ error: "validation_error", message: "type, amount_original, and currency_code are required" });
    return;
  }
  if (!["income", "expense"].includes(type)) {
    res.status(400).json({ error: "validation_error", message: "type must be 'income' or 'expense'" });
    return;
  }
  const amt = parseFloat(String(amount_original));
  if (isNaN(amt) || amt <= 0) {
    res.status(400).json({ error: "validation_error", message: "amount_original must be a positive number" });
    return;
  }

  try {
    const [account] = await db.select().from(accountsTable).where(eq(accountsTable.user_id, req.userId!));
    if (!account) {
      res.status(404).json({ error: "not_found", message: "No account found for this user" });
      return;
    }

    const [currency] = await db.select().from(currenciesTable).where(eq(currenciesTable.code, currency_code.toUpperCase()));
    const rateToUsd = currency ? parseFloat(String(currency.rate_to_usd)) : 1.0;
    const amountUsd = amt * rateToUsd;

    const [transaction] = await db
      .insert(transactionsTable)
      .values({
        account_id: account.id,
        type,
        amount_original: String(amt),
        currency_code: currency_code.toUpperCase(),
        amount_usd: String(Math.round(amountUsd * 100) / 100),
        fx_rate_used: String(rateToUsd),
        notes: notes || null,
        transacted_at: transacted_at ? new Date(transacted_at) : new Date(),
        synced: true,
      })
      .returning();

    res.status(201).json(transaction);
  } catch (err) {
    req.log.error({ err }, "Create transaction error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.patch("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { type, amount_original, currency_code, notes, transacted_at } = req.body;

  try {
    const userAccounts = await db.select({ id: accountsTable.id }).from(accountsTable).where(eq(accountsTable.user_id, req.userId!));
    const accountIds = userAccounts.map((a) => a.id);
    if (accountIds.length === 0) {
      res.status(403).json({ error: "unauthorized", message: "Unauthorized" });
      return;
    }
    const idArr = sql`ARRAY[${sql.join(accountIds.map((aid) => sql`${aid}`), sql`, `)}]::text[]`;
    const [existing] = await db.select().from(transactionsTable).where(
      and(eq(transactionsTable.id, id), sql`${transactionsTable.account_id} = ANY(${idArr})`, isNull(transactionsTable.deleted_at))
    );
    if (!existing) {
      res.status(403).json({ error: "unauthorized", message: "Unauthorized" });
      return;
    }

    const updates: Partial<typeof transactionsTable.$inferInsert> = {};
    if (type) updates.type = type;
    if (notes !== undefined) updates.notes = notes;
    if (transacted_at) updates.transacted_at = new Date(transacted_at);

    if (amount_original !== undefined || currency_code !== undefined) {
      const newCurrency = currency_code ?? existing.currency_code;
      const newAmount = amount_original !== undefined ? parseFloat(String(amount_original)) : parseFloat(String(existing.amount_original));
      const [rateRow] = await db.select().from(currenciesTable).where(eq(currenciesTable.code, newCurrency));
      const rate = rateRow ? parseFloat(String(rateRow.rate_to_usd)) : 1;
      updates.currency_code = newCurrency;
      updates.amount_original = String(newAmount) as any;
      updates.amount_usd = String(Math.round(newAmount * rate * 100) / 100) as any;
      updates.fx_rate_used = String(rate) as any;
    }

    const [updated] = await db.update(transactionsTable).set(updates).where(eq(transactionsTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update transaction error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const userAccounts = await db.select({ id: accountsTable.id }).from(accountsTable).where(eq(accountsTable.user_id, req.userId!));
    const accountIds = userAccounts.map((a) => a.id);
    if (accountIds.length === 0) {
      res.status(404).json({ error: "not_found", message: "Transaction not found" });
      return;
    }
    const idArr = sql`ARRAY[${sql.join(accountIds.map((aid) => sql`${aid}`), sql`, `)}]::text[]`;
    const [transaction] = await db.select().from(transactionsTable).where(
      and(eq(transactionsTable.id, id), sql`${transactionsTable.account_id} = ANY(${idArr})`, isNull(transactionsTable.deleted_at))
    );
    if (!transaction) {
      res.status(404).json({ error: "not_found", message: "Transaction not found" });
      return;
    }
    await db.update(transactionsTable).set({ deleted_at: new Date() }).where(eq(transactionsTable.id, id));
    res.json({ success: true, message: "Transaction deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete transaction error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

export default router;
