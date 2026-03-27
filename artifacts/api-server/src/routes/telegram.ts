import { Router, Response } from "express";
import { db } from "@workspace/db";
import { usersTable, telegramLinkCodesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/link-code", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires_at = new Date(Date.now() + 10 * 60 * 1000);

    await db.insert(telegramLinkCodesTable).values({
      code,
      user_id: req.userId!,
      expires_at,
      used: false,
    });

    res.json({ code });
  } catch (err) {
    req.log.error({ err }, "Generate link code error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.post("/disconnect", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await db
      .update(usersTable)
      .set({ telegram_chat_id: null })
      .where(eq(usersTable.id, req.userId!));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Telegram disconnect error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.get("/status", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [user] = await db.select({ telegram_chat_id: usersTable.telegram_chat_id }).from(usersTable).where(eq(usersTable.id, req.userId!));
    res.json({ connected: !!user?.telegram_chat_id });
  } catch (err) {
    req.log.error({ err }, "Telegram status error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

export default router;
