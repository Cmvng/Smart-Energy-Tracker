import { Router, Response } from "express";
import { db } from "@workspace/db";
import { usersTable, notificationsLogTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

async function sendReminder(userId: string, email: string, message: string) {
  logger.info({ userId, email }, `Reminder: ${email} — ${message}`);
  await db.insert(notificationsLogTable).values({
    user_id: userId,
    type: "reminder",
    message,
  });
}

router.post("/test", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }

    const message = "log your finances today";
    await sendReminder(user.id, user.email, message);

    res.json({ success: true, message: `Reminder sent to ${user.email}` });
  } catch (err) {
    req.log.error({ err }, "Notification test error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

export { sendReminder };
export default router;
