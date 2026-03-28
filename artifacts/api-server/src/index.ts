import app from "./app";
import { logger } from "./lib/logger";
import { startNotificationCron } from "./jobs/notificationCron";
import { seedCurrencies, seedDemoUser } from "./jobs/seed";
import { startTelegramBot, startTelegramCrons } from "./telegram-bot";
import { logDocumentParserStatus } from "./document-parser";

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
  console.log("OpenAI key present:", !!process.env.OPENAI_API_KEY, "length:", process.env.OPENAI_API_KEY?.length);

  logDocumentParserStatus();
  await seedCurrencies();
  await seedDemoUser();
  startNotificationCron();
  startTelegramBot();
  startTelegramCrons();
});
