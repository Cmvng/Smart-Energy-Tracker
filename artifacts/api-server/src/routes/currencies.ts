import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { currenciesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { Response } from "express";

const router: IRouter = Router();

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const currencies = await db.select().from(currenciesTable).orderBy(currenciesTable.code);
    res.json(currencies);
  } catch (err) {
    req.log.error({ err }, "Get currencies error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.post("/refresh", requireAuth, async (req: AuthRequest, res: Response) => {
  const apiKey = process.env.EXCHANGE_RATES_API_KEY;

  if (!apiKey || apiKey === "PLACEHOLDER_REPLACE_ME" || apiKey.startsWith("PLACEHOLDER")) {
    res.json({ updated: 0, note: "using cached rates" });
    return;
  }

  try {
    const response = await fetch(
      `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=USD`
    );

    if (!response.ok) {
      res.json({ updated: 0, note: "using cached rates" });
      return;
    }

    const data = (await response.json()) as { rates: Record<string, number> };
    const rates = data.rates;
    const now = new Date();
    let updatedCount = 0;

    for (const [code, rate] of Object.entries(rates)) {
      const existing = await db.select().from(currenciesTable).where(eq(currenciesTable.code, code));
      if (existing.length > 0) {
        await db.update(currenciesTable).set({ rate_to_usd: String(rate), rate_updated_at: now }).where(eq(currenciesTable.code, code));
        updatedCount++;
      }
    }

    res.json({ updated: updatedCount, message: `Updated ${updatedCount} currency rates` });
  } catch (err) {
    req.log.error({ err }, "Refresh currencies error");
    res.json({ updated: 0, note: "using cached rates" });
  }
});

export default router;
