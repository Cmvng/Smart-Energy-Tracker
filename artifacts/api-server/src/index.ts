import app from "./app";
import { logger } from "./lib/logger";
import { startNotificationCron } from "./jobs/notificationCron";
import { seedCurrencies, seedDemoUser } from "./jobs/seed";
import { startTelegramBot, sendMorningReminders, sendEveningReminders } from "./telegram-bot";
import cron from "node-cron";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  console.log("DB connected:", !!process.env.DATABASE_URL);
  console.log("JWT_SECRET set:", !!process.env.JWT_SECRET);

  await seedCurrencies();
  await seedDemoUser();
  startNotificationCron();
  startTelegramBot();

  cron.schedule("0 8 * * *", () => { sendMorningReminders().catch((e) => logger.error({ e }, "Morning cron error")); });
  cron.schedule("0 20 * * *", () => { sendEveningReminders().catch((e) => logger.error({ e }, "Evening cron error")); });
  logger.info("Telegram reminder crons scheduled (8am + 8pm UTC)");
});
