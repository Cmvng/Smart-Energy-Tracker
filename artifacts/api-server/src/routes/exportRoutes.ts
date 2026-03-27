import { Router, Response } from "express";
import { db } from "@workspace/db";
import { transactionsTable, accountsTable } from "@workspace/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/csv", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [account] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.user_id, req.userId!));

    if (!account) {
      res.status(404).json({ error: "not_found", message: "Account not found" });
      return;
    }

    const txns = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.account_id, account.id),
          isNull(transactionsTable.deleted_at)
        )
      )
      .orderBy(asc(transactionsTable.transacted_at));

    const header = "id,type,amount_original,currency_code,amount_usd,fx_rate_used,notes,transacted_at,created_at";
    const rows = txns.map((t) =>
      [
        t.id,
        t.type,
        t.amount_original,
        t.currency_code,
        t.amount_usd,
        t.fx_rate_used,
        `"${(t.notes || "").replace(/"/g, '""')}"`,
        t.transacted_at?.toISOString() ?? "",
        t.created_at?.toISOString() ?? "",
      ].join(",")
    );

    const csv = [header, ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    req.log.error({ err }, "Export CSV error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

export default router;
