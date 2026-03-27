import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable, accountsTable, currenciesTable } from "@workspace/db/schema";
import { eq, and, gte, isNull, sql, sum, count } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { Response, Request } from "express";

const router: IRouter = Router();

function getTimeframeStart(timeframe: string): Date {
  const now = new Date();
  switch (timeframe) {
    case "day":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    default:
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}

function getElapsedHours(timeframe: string): number {
  const start = getTimeframeStart(timeframe);
  const now = new Date();
  const ms = now.getTime() - start.getTime();
  return Math.max(ms / (1000 * 60 * 60), 0.0167);
}

router.get("/summary", requireAuth, async (req: AuthRequest, res: Response) => {
  const timeframe = (req.query.timeframe as string) || "day";
  const periodStart = getTimeframeStart(timeframe);

  try {
    const userAccounts = await db
      .select({ id: accountsTable.id })
      .from(accountsTable)
      .where(eq(accountsTable.user_id, req.userId!));

    if (userAccounts.length === 0) {
      res.json({
        total_income_usd: 0,
        total_expense_usd: 0,
        net_usd: 0,
        transaction_count: 0,
        income_rate_per_hour: 0,
        expense_rate_per_hour: 0,
        profit_status: "breakeven",
        timeframe,
      });
      return;
    }

    const accountIds = userAccounts.map((a) => a.id);

    const rows = await db
      .select({
        type: transactionsTable.type,
        total: sum(transactionsTable.amount_usd),
        cnt: count(),
      })
      .from(transactionsTable)
      .where(
        and(
          sql`${transactionsTable.account_id} = ANY(${sql`ARRAY[${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)}]`})`,
          gte(transactionsTable.transacted_at, periodStart),
          isNull(transactionsTable.deleted_at)
        )
      )
      .groupBy(transactionsTable.type);

    let totalIncomeUsd = 0;
    let totalExpenseUsd = 0;
    let totalCount = 0;

    for (const row of rows) {
      const val = parseFloat(row.total ?? "0");
      const c = Number(row.cnt ?? 0);
      if (row.type === "income") {
        totalIncomeUsd = val;
        totalCount += c;
      } else if (row.type === "expense") {
        totalExpenseUsd = val;
        totalCount += c;
      }
    }

    const netUsd = totalIncomeUsd - totalExpenseUsd;
    const elapsedHours = getElapsedHours(timeframe);
    const incomeRatePerHour = totalIncomeUsd / elapsedHours;
    const expenseRatePerHour = totalExpenseUsd / elapsedHours;
    const profitStatus = netUsd > 0.005 ? "profit" : netUsd < -0.005 ? "loss" : "breakeven";

    res.json({
      total_income_usd: Math.round(totalIncomeUsd * 100) / 100,
      total_expense_usd: Math.round(totalExpenseUsd * 100) / 100,
      net_usd: Math.round(netUsd * 100) / 100,
      transaction_count: totalCount,
      income_rate_per_hour: Math.round(incomeRatePerHour * 100) / 100,
      expense_rate_per_hour: Math.round(expenseRatePerHour * 100) / 100,
      profit_status: profitStatus,
      timeframe,
    });
  } catch (err) {
    req.log.error({ err }, "Get summary error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const { account_id, type, amount_original, currency_code, notes, transacted_at } = req.body;

  if (!account_id || !type || !amount_original || !currency_code) {
    res.status(400).json({
      error: "validation_error",
      message: "account_id, type, amount_original, and currency_code are required",
    });
    return;
  }

  if (!["income", "expense"].includes(type)) {
    res.status(400).json({ error: "validation_error", message: "type must be income or expense" });
    return;
  }

  try {
    const account = await db
      .select()
      .from(accountsTable)
      .where(and(eq(accountsTable.id, account_id), eq(accountsTable.user_id, req.userId!)));

    if (account.length === 0) {
      res.status(400).json({ error: "validation_error", message: "Invalid account_id" });
      return;
    }

    const [currency] = await db
      .select()
      .from(currenciesTable)
      .where(eq(currenciesTable.code, currency_code.toUpperCase()));

    // rate_to_usd = "X units of currency per 1 USD" (e.g. NGN 1580 means 1580 NGN = 1 USD)
    // So: amount_usd = amount_original / rate_to_usd
    const fxRate = currency ? parseFloat(currency.rate_to_usd) : 1;
    const amountUsd = fxRate > 0 ? parseFloat(amount_original) / fxRate : parseFloat(amount_original);

    const [transaction] = await db
      .insert(transactionsTable)
      .values({
        account_id,
        type,
        amount_original: String(amount_original),
        currency_code: currency_code.toUpperCase(),
        amount_usd: String(Math.round(amountUsd * 100) / 100),
        fx_rate_used: String(fxRate),
        notes: notes || null,
        transacted_at: transacted_at ? new Date(transacted_at) : new Date(),
      })
      .returning();

    res.status(201).json(transaction);
  } catch (err) {
    req.log.error({ err }, "Create transaction error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const timeframe = req.query.timeframe as string | undefined;
  const typeFilter = req.query.type as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    const userAccounts = await db
      .select({ id: accountsTable.id })
      .from(accountsTable)
      .where(eq(accountsTable.user_id, req.userId!));

    if (userAccounts.length === 0) {
      res.json({ transactions: [], total: 0, limit, offset });
      return;
    }

    const accountIds = userAccounts.map((a) => a.id);
    const accountIdArray = sql`ARRAY[${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)}]`;

    const conditions = [
      sql`${transactionsTable.account_id} = ANY(${accountIdArray})`,
      isNull(transactionsTable.deleted_at),
    ];

    if (timeframe) {
      conditions.push(gte(transactionsTable.transacted_at, getTimeframeStart(timeframe)));
    }

    if (typeFilter && ["income", "expense"].includes(typeFilter)) {
      conditions.push(eq(transactionsTable.type, typeFilter));
    }

    const whereClause = and(...conditions);

    const [{ total }] = await db
      .select({ total: count() })
      .from(transactionsTable)
      .where(whereClause);

    const transactions = await db
      .select()
      .from(transactionsTable)
      .where(whereClause)
      .orderBy(sql`${transactionsTable.transacted_at} DESC`)
      .limit(limit)
      .offset(offset);

    res.json({ transactions, total: Number(total), limit, offset });
  } catch (err) {
    req.log.error({ err }, "List transactions error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const userAccounts = await db
      .select({ id: accountsTable.id })
      .from(accountsTable)
      .where(eq(accountsTable.user_id, req.userId!));

    const accountIds = userAccounts.map((a) => a.id);

    const [transaction] = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.id, id),
          sql`${transactionsTable.account_id} = ANY(ARRAY[${sql.join(accountIds.map((aid) => sql`${aid}`), sql`, `)}])`,
          isNull(transactionsTable.deleted_at)
        )
      );

    if (!transaction) {
      res.status(404).json({ error: "not_found", message: "Transaction not found" });
      return;
    }

    await db
      .update(transactionsTable)
      .set({ deleted_at: new Date() })
      .where(eq(transactionsTable.id, id));

    res.json({ success: true, message: "Transaction deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete transaction error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

export default router;
