import cron from "node-cron";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sendReminder } from "../routes/notifications";
import { logger } from "../lib/logger";

export function startNotificationCron() {
  cron.schedule("0 9 * * *", async () => {
    logger.info("Running daily notification job");
    try {
      const users = await db
        .select({ id: usersTable.id, email: usersTable.email, notification_frequency: usersTable.notification_frequency })
        .from(usersTable);

      const today = new Date();
      const dayOfWeek = today.getDay();

      for (const user of users) {
        const freq = user.notification_frequency;
        if (freq === "off") continue;

        let shouldSend = false;
        if (freq === "daily") {
          shouldSend = true;
        } else if (freq === "weekly" && dayOfWeek === 1) {
          shouldSend = true;
        } else if (freq === "every_3_days" && today.getDate() % 3 === 0) {
          shouldSend = true;
        }

        if (shouldSend) {
          await sendReminder(user.id, user.email, "log your finances today");
        }
      }
    } catch (err) {
      logger.error({ err }, "Notification cron error");
    }
  });

  logger.info("Notification cron job scheduled (daily at 9am)");
}
