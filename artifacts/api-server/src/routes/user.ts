import { Router, Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

const VALID_MODES = ["individual", "business"];
const VALID_NOTIF = ["daily", "every_3_days", "weekly", "off"];

router.patch("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const { home_currency, mode, notification_frequency } = req.body;

  if (mode && !VALID_MODES.includes(mode)) {
    res.status(400).json({ error: "validation_error", message: "Invalid mode" });
    return;
  }
  if (notification_frequency && !VALID_NOTIF.includes(notification_frequency)) {
    res.status(400).json({ error: "validation_error", message: "Invalid notification_frequency" });
    return;
  }

  try {
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (home_currency) updates.home_currency = home_currency;
    if (mode) updates.mode = mode;
    if (notification_frequency) updates.notification_frequency = notification_frequency;

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, req.userId!))
      .returning();

    res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      mode: updated.mode,
      home_currency: updated.home_currency,
      notification_frequency: updated.notification_frequency,
      created_at: updated.created_at,
    });
  } catch (err) {
    req.log.error({ err }, "Update user error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

export default router;
