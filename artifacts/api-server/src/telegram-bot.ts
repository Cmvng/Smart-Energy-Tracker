import TelegramBot from "node-telegram-bot-api";
import { pool } from "@workspace/db";
import cron from "node-cron";
import { logger } from "./lib/logger";

const token = process.env.TELEGRAM_BOT_TOKEN;
export let bot: TelegramBot | null = null;

const APP_URL = process.env.APP_URL || "";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatMoney(n: number): string {
  return "$" + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function netEmoji(net: number): string {
  if (net > 0) return "🟢 Profit";
  if (net < 0) return "🔴 Loss";
  return "🟡 Breakeven";
}

const NOT_LINKED = `👋 Your Telegram isn't linked yet!
Open the app → Settings → Setup Telegram Reminders
Then tap Start here and you're done 🔗
App: ${APP_URL}`;

async function getUserByChatId(chatId: number) {
  const r = await pool.query("SELECT * FROM users WHERE telegram_chat_id = $1 LIMIT 1", [String(chatId)]);
  return r.rows[0] ?? null;
}

async function getUserAccount(userId: string) {
  const r = await pool.query("SELECT * FROM accounts WHERE user_id = $1 LIMIT 1", [userId]);
  return r.rows[0] ?? null;
}

async function getTodaySummary(accountId: string, since?: Date) {
  const todayStart = since ?? (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; })();
  const r = await pool.query(
    `SELECT
      COALESCE(SUM(CASE WHEN type='income' THEN amount_usd::numeric ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount_usd::numeric ELSE 0 END), 0) as expenses,
      COUNT(*) as count
    FROM transactions
    WHERE account_id = $1 AND deleted_at IS NULL AND transacted_at >= $2`,
    [accountId, todayStart]
  );
  const row = r.rows[0];
  const income = parseFloat(row.income);
  const expenses = parseFloat(row.expenses);
  return { income, expenses, net: income - expenses, count: parseInt(row.count) };
}

async function getWeekSummary(accountId: string) {
  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
  weekStart.setUTCHours(0, 0, 0, 0);
  const r = await pool.query(
    `SELECT
      COALESCE(SUM(CASE WHEN type='income' THEN amount_usd::numeric ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount_usd::numeric ELSE 0 END), 0) as expenses,
      COUNT(*) as count
    FROM transactions
    WHERE account_id = $1 AND deleted_at IS NULL AND transacted_at >= $2`,
    [accountId, weekStart]
  );
  const row = r.rows[0];
  const income = parseFloat(row.income);
  const expenses = parseFloat(row.expenses);
  return { income, expenses, net: income - expenses, count: parseInt(row.count) };
}

async function safeSend(chatId: number | string, text: string, opts?: TelegramBot.SendMessageOptions) {
  try {
    await bot!.sendMessage(Number(chatId), text, opts);
  } catch (err) {
    logger.error({ err }, "Telegram send error");
  }
}

function shouldSendToday(freq: string): boolean {
  const day = new Date().getUTCDay();
  if (freq === "daily") return true;
  if (freq === "every_3_days" || freq === "every3days") return [1, 3, 5].includes(day);
  if (freq === "weekly") return day === 0;
  return false;
}

// ─── bot initialization ───────────────────────────────────────────────────────

export function startTelegramBot() {
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
    return;
  }

  bot = new TelegramBot(token, { polling: true });

  // /start — no params (opened bot directly)
  bot.onText(/^\/start$/, async (msg) => {
    await safeSend(msg.chat.id,
      `👋 Hi! I'm your Smart i-n-E Tracker bot!\n\nTo get started, open the app and tap:\nSettings → Setup Telegram Reminders\nThen come back and press Start on that link 💰\n\nApp: ${APP_URL}`
    );
  });

  // /start [user_id] — from deep link in app
  bot.onText(/^\/start (.+)$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = match![1].trim();
    try {
      const result = await pool.query(
        "UPDATE users SET telegram_chat_id = $1 WHERE id = $2 RETURNING *",
        [String(chatId), userId]
      );
      if (result.rows.length === 0) {
        await safeSend(chatId, "❌ Could not find your account. Please try again from the app.");
        return;
      }
      const user = result.rows[0];
      await safeSend(chatId,
        `🎉 You're all set ${user.name}!\n\nI'll send you reminders to track your finances 💰\n\nHere's what I can do:\n📊 /summary — today's numbers\n📅 /week — this week's totals\n💰 /add income 5000 NGN freelance\n💸 /add expense 2000 NGN groceries\n\nOr just send me a number and I'll guide you!\nYour first reminder arrives tonight 🌙`
      );
    } catch (e) {
      logger.error({ e }, "/start [userId] error");
      await safeSend(chatId, "😅 Something went wrong. Try again from the app.");
    }
  });

  // /summary
  bot.onText(/^\/summary$/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const user = await getUserByChatId(chatId);
      if (!user) { await safeSend(chatId, NOT_LINKED); return; }
      const account = await getUserAccount(user.id);
      if (!account) { await safeSend(chatId, "😅 No account found. Please open the app first."); return; }
      const s = await getTodaySummary(account.id);
      const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      await safeSend(chatId,
        `📊 Today — ${today}\n━━━━━━━━━━━━━━━\n💚 Income:    ${formatMoney(s.income)}\n❤️ Expenses:  ${formatMoney(s.expenses)}\n━━━━━━━━━━━━━━━\n${netEmoji(s.net)}: ${s.net >= 0 ? "+" : "-"}${formatMoney(s.net)}\n${s.count} transaction${s.count !== 1 ? "s" : ""} logged${s.count === 0 ? "\n\nNothing logged yet today 👀\nTap /add to log something!" : ""}`
      );
    } catch (e) {
      logger.error({ e }, "/summary error");
      await safeSend(chatId, "😅 Could not load your summary. Try again!");
    }
  });

  // /week
  bot.onText(/^\/week$/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const user = await getUserByChatId(chatId);
      if (!user) { await safeSend(chatId, NOT_LINKED); return; }
      const account = await getUserAccount(user.id);
      if (!account) { await safeSend(chatId, "😅 No account found. Please open the app first."); return; }
      const s = await getWeekSummary(account.id);
      const motivate = s.net > 0 ? "\nGreat week! Keep it up 🏆" : s.net < 0 ? "\nTough week. Tomorrow is a new chance 💪" : "\nExactly even — log more income! 😄";
      await safeSend(chatId,
        `📅 This Week\n━━━━━━━━━━━━━━━\n💚 Income:    ${formatMoney(s.income)}\n❤️ Expenses:  ${formatMoney(s.expenses)}\n━━━━━━━━━━━━━━━\n${netEmoji(s.net)}: ${s.net >= 0 ? "+" : "-"}${formatMoney(s.net)}\n${s.count} transaction${s.count !== 1 ? "s" : ""} this week${motivate}`
      );
    } catch (e) {
      logger.error({ e }, "/week error");
      await safeSend(chatId, "😅 Could not load weekly data. Try again!");
    }
  });

  // /add income|expense [amount] [currency?] [note?]
  bot.onText(/^\/add (income|expense) (\S+)(?: (\S+))?(?: (.+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const type = match![1] as "income" | "expense";
    const amountRaw = parseFloat(match![2]);
    const currencyRaw = match![3] ? match![3].toUpperCase() : null;
    const note = match![4] || "";

    if (isNaN(amountRaw) || amountRaw <= 0) {
      await safeSend(chatId, `🤔 Invalid amount. Try: /add ${type} 5000 NGN groceries`);
      return;
    }

    try {
      const user = await getUserByChatId(chatId);
      if (!user) { await safeSend(chatId, NOT_LINKED); return; }
      const account = await getUserAccount(user.id);
      if (!account) { await safeSend(chatId, "😅 No account found. Please open the app first."); return; }

      const currency = currencyRaw || user.home_currency || "USD";
      const rateResult = await pool.query("SELECT rate_to_usd FROM currencies WHERE code = $1", [currency]);
      const rate = rateResult.rows.length > 0 ? parseFloat(rateResult.rows[0].rate_to_usd) : 1.0;
      const usedFallback = rateResult.rows.length === 0;
      const amount_usd = amountRaw * rate;

      await pool.query(
        `INSERT INTO transactions (id, account_id, type, amount_original, currency_code, amount_usd, fx_rate_used, notes, transacted_at, synced)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), true)`,
        [account.id, type, amountRaw, currency, amount_usd, rate, note || null]
      );

      const s = await getTodaySummary(account.id);
      const emoji = type === "income" ? "💰" : "💸";
      const typeLabel = type === "income" ? "Income" : "Expense";
      const motivate = s.net > 0 ? "You're in profit! 🚀" : s.net < 0 ? "You're at a loss. Log more income! 💪" : "Exactly even 🟡";

      await safeSend(chatId,
        `✅ ${typeLabel} logged! ${emoji}\n${currency} ${amountRaw.toLocaleString()} = ${formatMoney(amount_usd)} USD${usedFallback ? "\n⚠️ Currency not found, used 1:1 rate" : ""}\n━━━━━━━━━━━━━━━\n📊 Today so far:\n💚 Income:   ${formatMoney(s.income)}\n❤️ Expenses: ${formatMoney(s.expenses)}\n${netEmoji(s.net)}: ${s.net >= 0 ? "+" : "-"}${formatMoney(s.net)}\n━━━━━━━━━━━━━━━\n${motivate}`
      );
    } catch (e) {
      logger.error({ e }, "/add error");
      await safeSend(chatId, "😅 Could not save that. Try again!");
    }
  });

  // /reminders
  bot.onText(/^\/reminders$/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const user = await getUserByChatId(chatId);
      if (!user) { await safeSend(chatId, NOT_LINKED); return; }
      await safeSend(chatId,
        `⚙️ Your current reminder: *${user.notification_frequency || "daily"}*\n\nChange it:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🌅 Daily", callback_data: "freq_daily" }, { text: "📅 Every 3 Days", callback_data: "freq_every_3_days" }],
              [{ text: "📆 Weekly", callback_data: "freq_weekly" }, { text: "🔕 Off", callback_data: "freq_off" }],
            ],
          },
        }
      );
    } catch (e) {
      logger.error({ e }, "/reminders error");
      await safeSend(chatId, "😅 Could not load settings. Try again!");
    }
  });

  // /help
  bot.onText(/^\/help$/, async (msg) => {
    await safeSend(msg.chat.id,
      `💰 Smart i-n-E Tracker Bot\n\nHere's everything I can do:\n\n📊 /summary — today's income, expenses & profit\n📅 /week — this week's totals\n💰 /add income [amount] [currency] [note]\n   Example: /add income 50000 NGN freelance\n💸 /add expense [amount] [currency] [note]\n   Example: /add expense 5000 NGN groceries\n🔢 Send any number — I'll ask income or expense\n⚙️ /reminders — change reminder schedule\n\nOpen the app for charts & full history:\n${APP_URL}`
    );
  });

  // Bare number handler
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();
    if (text.startsWith("/")) return;

    if (/^\d+(\.\d+)?$/.test(text)) {
      const amount = parseFloat(text);
      try {
        const user = await getUserByChatId(chatId);
        if (!user) { await safeSend(chatId, NOT_LINKED); return; }

        await pool.query(
          `INSERT INTO telegram_sessions (user_id, state, data, updated_at)
           VALUES ($1, 'awaiting_type', $2, NOW())
           ON CONFLICT (user_id) DO UPDATE SET state='awaiting_type', data=$2, updated_at=NOW()`,
          [user.id, JSON.stringify({ amount })]
        );

        await safeSend(chatId,
          `Got ${user.home_currency || "USD"} ${amount.toLocaleString()}! What was this? 👇`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: "💰 Income", callback_data: "type_income" },
                { text: "💸 Expense", callback_data: "type_expense" },
              ]],
            },
          }
        );
      } catch (e) {
        logger.error({ e }, "bare number error");
      }
      return;
    }

    // Unknown message
    const user = await getUserByChatId(chatId).catch(() => null);
    if (!user) { await safeSend(chatId, NOT_LINKED); return; }
    await safeSend(chatId,
      `🤔 I didn't understand that.\nTry:\n📊 /summary\n💰 /add income 5000 NGN\n💸 /add expense 2000 USD groceries\nOr just send a number like: 5000`
    );
  });

  // Callback queries
  bot.on("callback_query", async (query) => {
    const chatId = query.message?.chat.id!;
    const data = query.data ?? "";

    try {
      const user = await getUserByChatId(chatId);
      if (!user) {
        await bot!.answerCallbackQuery(query.id, { text: "Please link your account first" });
        return;
      }

      // Income/Expense type selection (from bare number)
      if (data === "type_income" || data === "type_expense") {
        const type = data === "type_income" ? "income" : "expense";
        const sessionResult = await pool.query(
          "SELECT data FROM telegram_sessions WHERE user_id = $1 AND state = 'awaiting_type'",
          [user.id]
        );
        if (sessionResult.rows.length === 0) {
          await bot!.answerCallbackQuery(query.id, { text: "Session expired, please try again" });
          return;
        }
        const { amount } = sessionResult.rows[0].data as { amount: number };
        const currency = user.home_currency || "USD";
        const rateResult = await pool.query("SELECT rate_to_usd FROM currencies WHERE code = $1", [currency]);
        const rate = rateResult.rows.length > 0 ? parseFloat(rateResult.rows[0].rate_to_usd) : 1.0;
        const amount_usd = amount * rate;
        const account = await getUserAccount(user.id);

        await pool.query(
          `INSERT INTO transactions (id, account_id, type, amount_original, currency_code, amount_usd, fx_rate_used, notes, transacted_at, synced)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, '', NOW(), true)`,
          [account.id, type, amount, currency, amount_usd, rate]
        );
        await pool.query("DELETE FROM telegram_sessions WHERE user_id = $1", [user.id]);

        const s = await getTodaySummary(account.id);
        await bot!.answerCallbackQuery(query.id, { text: "✅ Saved!" });
        await bot!.editMessageText(
          `✅ ${type === "income" ? "Income" : "Expense"} saved!\n${currency} ${amount.toLocaleString()} = ${formatMoney(amount_usd)} USD\n\n📊 Today: Income ${formatMoney(s.income)} · Expenses ${formatMoney(s.expenses)}\n${netEmoji(s.net)}: ${s.net >= 0 ? "+" : "-"}${formatMoney(s.net)}`,
          { chat_id: chatId, message_id: query.message!.message_id }
        );
        return;
      }

      // Reminder frequency selection
      if (data.startsWith("freq_")) {
        const freq = data.replace("freq_", "");
        await pool.query("UPDATE users SET notification_frequency = $1 WHERE id = $2", [freq, user.id]);
        const labels: Record<string, string> = {
          daily: "every day 🌅",
          every_3_days: "Monday, Wednesday & Friday 📅",
          weekly: "every Sunday 📆",
          off: "never 🔕",
        };
        await bot!.answerCallbackQuery(query.id, { text: "✅ Saved!" });
        await bot!.editMessageText(
          `✅ Got it! I'll remind you ${labels[freq] ?? freq}`,
          { chat_id: chatId, message_id: query.message!.message_id }
        );
        return;
      }

      // Quick log from reminders
      if (data === "quick_income" || data === "quick_expense") {
        const type = data === "quick_income" ? "income" : "expense";
        await pool.query(
          `INSERT INTO telegram_sessions (user_id, state, data, updated_at)
           VALUES ($1, $2, '{}', NOW())
           ON CONFLICT (user_id) DO UPDATE SET state=$2, data='{}', updated_at=NOW()`,
          [user.id, `awaiting_${type}_amount`]
        );
        await bot!.answerCallbackQuery(query.id, { text: "Send the amount!" });
        await safeSend(chatId, `How much ${type}? Send amount + currency e.g. *5000 NGN*`, { parse_mode: "Markdown" });
        return;
      }

      // Yesterday summary
      if (data === "summary_yesterday") {
        const account = await getUserAccount(user.id);
        if (!account) { await bot!.answerCallbackQuery(query.id, { text: "No account found" }); return; }
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        yesterday.setUTCHours(0, 0, 0, 0);
        const s = await getTodaySummary(account.id, yesterday);
        await bot!.answerCallbackQuery(query.id, { text: "Fetching..." });
        await safeSend(chatId,
          `📊 Yesterday\n━━━━━━━━━━━━━━━\n💚 Income:   ${formatMoney(s.income)}\n❤️ Expenses: ${formatMoney(s.expenses)}\n${netEmoji(s.net)}: ${s.net >= 0 ? "+" : "-"}${formatMoney(s.net)}`
        );
        return;
      }

      // All done today
      if (data === "done_today") {
        const account = await getUserAccount(user.id);
        if (!account) { await bot!.answerCallbackQuery(query.id, { text: "No account found" }); return; }
        const s = await getTodaySummary(account.id);
        await bot!.answerCallbackQuery(query.id, { text: "✅ Wrapping up!" });
        await safeSend(chatId,
          `🎉 Great day ${user.name}!\n━━━━━━━━━━━━━━━\n💚 Income:   ${formatMoney(s.income)}\n❤️ Expenses: ${formatMoney(s.expenses)}\n${netEmoji(s.net)}: ${s.net >= 0 ? "+" : "-"}${formatMoney(s.net)}\n${s.count} transactions logged\n━━━━━━━━━━━━━━━\nRest well, money boss! 🌙💰`
        );
        return;
      }

      await bot!.answerCallbackQuery(query.id, { text: "🤔 Unknown action" });
    } catch (e) {
      logger.error({ e }, "callback_query error");
      await bot!.answerCallbackQuery(query.id, { text: "😅 Something went wrong" }).catch(() => {});
    }
  });

  bot.on("polling_error", (err) => logger.error({ err }, "Telegram polling error"));

  logger.info("✅ Telegram bot is live!");
  console.log("✅ Telegram bot is live!");
}

// ─── scheduled reminders ─────────────────────────────────────────────────────

export function startTelegramCrons() {
  // Morning: 8AM UTC
  cron.schedule("0 8 * * *", async () => {
    if (!bot) return;
    try {
      const users = await pool.query(
        `SELECT * FROM users WHERE telegram_chat_id IS NOT NULL AND notification_frequency != 'off'`
      );
      const dayOfWeek = new Date().getUTCDay();

      for (const user of users.rows) {
        if (!shouldSendToday(user.notification_frequency)) continue;
        try {
          const account = await getUserAccount(user.id);
          if (!account) continue;

          const yesterday = new Date();
          yesterday.setUTCDate(yesterday.getUTCDate() - 1);
          yesterday.setUTCHours(0, 0, 0, 0);
          const yesterdayEnd = new Date(yesterday);
          yesterdayEnd.setUTCHours(23, 59, 59, 999);

          const yResult = await pool.query(
            `SELECT
              COALESCE(SUM(CASE WHEN type='income' THEN amount_usd::numeric ELSE 0 END),0) as income,
              COALESCE(SUM(CASE WHEN type='expense' THEN amount_usd::numeric ELSE 0 END),0) as expenses
            FROM transactions
            WHERE account_id=$1 AND deleted_at IS NULL AND transacted_at BETWEEN $2 AND $3`,
            [account.id, yesterday, yesterdayEnd]
          );
          const yi = parseFloat(yResult.rows[0].income);
          const ye = parseFloat(yResult.rows[0].expenses);
          const ynet = yi - ye;

          let yesterdayLine = "";
          if (yi > 0 || ye > 0) {
            yesterdayLine = ynet > 0
              ? `Yesterday you made ${formatMoney(ynet)} profit 🔥 Beat it today!`
              : `Yesterday was tough 💪 Today is a fresh start!`;
          }

          await safeSend(user.telegram_chat_id,
            `🌅 Good morning ${user.name}!${yesterdayLine ? "\n\n" + yesterdayLine : ""}\n\nNew day, new money moves 💪\nReady to track today? 👇`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "💰 Log Income", callback_data: "quick_income" }, { text: "💸 Log Expense", callback_data: "quick_expense" }],
                  [{ text: "📊 Yesterday Summary", callback_data: "summary_yesterday" }],
                ],
              },
            }
          );
        } catch (e) {
          logger.error({ e, userId: user.id }, "Morning reminder error");
        }
      }
    } catch (e) {
      logger.error({ e }, "Morning cron error");
    }
  });

  // Evening: 8PM UTC
  cron.schedule("0 20 * * *", async () => {
    if (!bot) return;
    try {
      const users = await pool.query(
        `SELECT * FROM users WHERE telegram_chat_id IS NOT NULL AND notification_frequency != 'off'`
      );

      for (const user of users.rows) {
        if (!shouldSendToday(user.notification_frequency)) continue;
        try {
          const account = await getUserAccount(user.id);
          if (!account) continue;
          const s = await getTodaySummary(account.id);

          const msg = s.count > 0
            ? `🌙 Evening check-in ${user.name}!\n\nToday so far:\n💚 Income: ${formatMoney(s.income)}\n❤️ Expenses: ${formatMoney(s.expenses)}\n${netEmoji(s.net)}: ${s.net >= 0 ? "+" : "-"}${formatMoney(s.net)}\n\nAnything else to add? 👇`
            : `🌙 Hey ${user.name}! 👀\n\nYou haven't logged anything today yet...\nDon't let the day go undocumented!\n\nQuick log 👇`;

          await safeSend(user.telegram_chat_id, msg, {
            reply_markup: {
              inline_keyboard: [
                [{ text: "💰 Add Income", callback_data: "quick_income" }, { text: "💸 Add Expense", callback_data: "quick_expense" }],
                [{ text: "✅ All done today", callback_data: "done_today" }],
              ],
            },
          });
        } catch (e) {
          logger.error({ e, userId: user.id }, "Evening reminder error");
        }
      }
    } catch (e) {
      logger.error({ e }, "Evening cron error");
    }
  });

  logger.info("Telegram reminder crons scheduled (8am + 8pm UTC)");
}
