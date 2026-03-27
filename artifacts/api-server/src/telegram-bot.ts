import TelegramBot from "node-telegram-bot-api";
import { db } from "@workspace/db";
import {
  usersTable,
  accountsTable,
  transactionsTable,
  currenciesTable,
  telegramLinkCodesTable,
  telegramSessionsTable,
} from "@workspace/db/schema";
import { eq, and, gte, isNotNull, sql } from "drizzle-orm";
import { logger } from "./lib/logger";

const token = process.env.TELEGRAM_BOT_TOKEN;
let bot: TelegramBot | null = null;

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

function todayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfWeekUTC() {
  const d = todayUTC();
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
}

async function getUserByChatId(chatId: number) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegram_chat_id, String(chatId)));
  return user ?? null;
}

async function getUserAccount(userId: string) {
  const [acct] = await db.select().from(accountsTable).where(eq(accountsTable.user_id, userId));
  return acct ?? null;
}

async function getDaySummary(accountId: string, since: Date = todayUTC()) {
  const rows = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.account_id, accountId),
        gte(transactionsTable.transacted_at, since),
        sql`${transactionsTable.deleted_at} IS NULL`
      )
    );

  let income = 0;
  let expense = 0;
  for (const r of rows) {
    const usd = parseFloat(r.amount_usd ?? "0");
    if (r.type === "income") income += usd;
    else expense += usd;
  }
  return { income, expense, net: income - expense, count: rows.length };
}

async function getWeekSummary(accountId: string) {
  const since = startOfWeekUTC();
  const rows = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.account_id, accountId),
        gte(transactionsTable.transacted_at, since),
        sql`${transactionsTable.deleted_at} IS NULL`
      )
    );

  let income = 0;
  let expense = 0;
  const byDay: Record<number, { income: number; expense: number }> = {};

  for (const r of rows) {
    const usd = parseFloat(r.amount_usd ?? "0");
    const day = new Date(r.transacted_at).getUTCDay();
    if (!byDay[day]) byDay[day] = { income: 0, expense: 0 };
    if (r.type === "income") { income += usd; byDay[day].income += usd; }
    else { expense += usd; byDay[day].expense += usd; }
  }

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let bestDay = { day: -1, net: -Infinity };
  let toughDay = { day: -1, net: Infinity };

  for (const [d, v] of Object.entries(byDay)) {
    const net = v.income - v.expense;
    if (net > bestDay.net) bestDay = { day: Number(d), net };
    if (net < toughDay.net) toughDay = { day: Number(d), net };
  }

  return {
    income,
    expense,
    net: income - expense,
    bestDay: bestDay.day >= 0 ? days[bestDay.day] : null,
    bestNet: bestDay.net,
    toughDay: toughDay.day >= 0 ? days[toughDay.day] : null,
    toughNet: toughDay.net,
  };
}

function netLine(net: number) {
  if (net > 0) return `🟢 Net: +${fmtUsd(net)}`;
  if (net < 0) return `🔴 Net: -${fmtUsd(Math.abs(net))}`;
  return `🟡 Breakeven: ${fmtUsd(0)}`;
}

function motiveLine(net: number, type: "income" | "expense") {
  if (type === "income") {
    return net >= 0 ? "You're crushing it today! 🚀" : "Keep going, every bit counts 💪";
  }
  return net >= 0 ? "Still in the green! 🟢" : `You're at -${fmtUsd(Math.abs(net))}. Log some income to turn it around! 💪`;
}

async function logTransaction(
  user: typeof usersTable.$inferSelect,
  account: typeof accountsTable.$inferSelect,
  type: "income" | "expense",
  amount: number,
  currencyCode: string,
  notes: string
) {
  const upperCurrency = currencyCode.toUpperCase();
  let [currency] = await db.select().from(currenciesTable).where(eq(currenciesTable.code, upperCurrency));

  let actualCurrency = upperCurrency;
  let fallbackMsg = "";

  if (!currency) {
    const [home] = await db.select().from(currenciesTable).where(eq(currenciesTable.code, user.home_currency));
    currency = home;
    actualCurrency = user.home_currency;
    fallbackMsg = `\n⚠️ Unknown currency "${upperCurrency}", used your home currency ${user.home_currency} instead.`;
  }

  const rate = parseFloat(currency?.rate_to_usd ?? "1");
  const amount_usd = amount * rate;

  await db.insert(transactionsTable).values({
    account_id: account.id,
    type,
    amount_original: String(amount),
    currency_code: actualCurrency,
    amount_usd: String(amount_usd),
    fx_rate_used: String(rate),
    notes: notes || null,
    transacted_at: new Date(),
  });

  return { amount_usd, rate, actualCurrency, fallbackMsg };
}

async function safeSend(chatId: number, text: string, opts?: TelegramBot.SendMessageOptions) {
  try {
    await bot!.sendMessage(chatId, text, { parse_mode: "Markdown", ...opts });
  } catch (err) {
    logger.error({ err }, "Telegram send error");
  }
}

// ─── session helpers ──────────────────────────────────────────────────────────

async function getSession(userId: string) {
  const [s] = await db.select().from(telegramSessionsTable).where(eq(telegramSessionsTable.user_id, userId));
  return s ?? null;
}

async function setSession(userId: string, state: string, data: Record<string, unknown> = {}) {
  await db
    .insert(telegramSessionsTable)
    .values({ user_id: userId, state, data, updated_at: new Date() })
    .onConflictDoUpdate({
      target: telegramSessionsTable.user_id,
      set: { state, data, updated_at: new Date() },
    });
}

async function clearSession(userId: string) {
  await setSession(userId, "idle", {});
}

// ─── bot commands ─────────────────────────────────────────────────────────────

async function handleStart(chatId: number) {
  await safeSend(
    chatId,
    `Hey! 👋 Welcome to Smart i-n-E Tracker!\nI'm your personal money buddy 💰\n\nTo link your account:\n1. Open the app\n2. Go to Settings → Connect Telegram\n3. Send me: /link [your 6-digit code]`
  );
}

async function handleLink(chatId: number, code: string) {
  if (!code || !/^\d{6}$/.test(code.trim())) {
    await safeSend(chatId, "Please send a valid 6-digit code. Example: `/link 123456`");
    return;
  }

  const now = new Date();
  const [linkRow] = await db
    .select()
    .from(telegramLinkCodesTable)
    .where(
      and(
        eq(telegramLinkCodesTable.code, code.trim()),
        eq(telegramLinkCodesTable.used, false)
      )
    );

  if (!linkRow || linkRow.expires_at < now) {
    await safeSend(chatId, "❌ That code is invalid or expired. Go to Settings → Connect Telegram to get a new one.");
    return;
  }

  await db.update(usersTable).set({ telegram_chat_id: String(chatId) }).where(eq(usersTable.id, linkRow.user_id));
  await db.update(telegramLinkCodesTable).set({ used: true }).where(eq(telegramLinkCodesTable.code, linkRow.code));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, linkRow.user_id));

  await safeSend(
    chatId,
    `🎉 You're all set ${user.name}!\nI'll check in with you daily 💪\n\nHere's what I can do:\n💰 /add income [amount] [currency] [note]\n💸 /add expense [amount] [currency] [note]\n📊 /summary — today's numbers\n📅 /week — this week\n⚙️ /reminders — change schedule\n\nJust send me a number and I'll guide you!`
  );
}

async function handleAdd(chatId: number, args: string[]) {
  const user = await getUserByChatId(chatId);
  if (!user) { await safeSend(chatId, "Link your account first! Open the app → Settings → Connect Telegram 🔗"); return; }

  const [typeStr, amountStr, currencyStr, ...noteParts] = args;
  const type = typeStr?.toLowerCase();

  if (type !== "income" && type !== "expense") {
    await safeSend(chatId, `Hmm, I didn't get that 🤔 Try:\n/add income 5000 NGN freelance\n/add expense 200 USD groceries`);
    return;
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    await safeSend(chatId, `Hmm, I didn't get that 🤔 Try: /add ${type} 5000 NGN freelance`);
    return;
  }

  const currency = currencyStr || user.home_currency;
  const notes = noteParts.join(" ");
  const account = await getUserAccount(user.id);
  if (!account) { await safeSend(chatId, "Something went wrong 😅 Try again!"); return; }

  try {
    const { amount_usd, actualCurrency, fallbackMsg } = await logTransaction(user, account, type, amount, currency, notes);
    const { income, expense, net } = await getDaySummary(account.id);
    const emoji = type === "income" ? "💰" : "💸";
    const label = type === "income" ? "Income logged!" : "Expense logged!";

    await safeSend(
      chatId,
      `✅ ${label} ${emoji}${fallbackMsg}\n${actualCurrency} ${amount.toLocaleString()} = ${fmtUsd(amount_usd)} USD\n━━━━━━━━━━━━━\n📊 Today:\n💚 Income: ${fmtUsd(income)}\n❤️ Expenses: ${fmtUsd(expense)}\n${netLine(net)}\n━━━━━━━━━━━━━\n${motiveLine(net, type)}`
    );
  } catch (err) {
    logger.error({ err }, "Telegram /add error");
    await safeSend(chatId, "Something went wrong 😅 Try again!");
  }
}

async function handleSummary(chatId: number) {
  const user = await getUserByChatId(chatId);
  if (!user) { await safeSend(chatId, "Link your account first! Open the app → Settings → Connect Telegram 🔗"); return; }
  const account = await getUserAccount(user.id);
  if (!account) { await safeSend(chatId, "Something went wrong 😅 Try again!"); return; }

  const { income, expense, net, count } = await getDaySummary(account.id);
  const today = fmtDate(new Date());

  let statusLine: string;
  let motivate: string;

  if (count === 0) {
    statusLine = "🟡 Nothing logged yet";
    motivate = "Nothing logged yet today 👀";
  } else if (net > 0) {
    statusLine = `🟢 PROFIT +${fmtUsd(net)}`;
    motivate = "Amazing day! 🏆";
  } else if (net < 0) {
    statusLine = `🔴 LOSS -${fmtUsd(Math.abs(net))}`;
    motivate = "Tomorrow is a fresh start! 💪";
  } else {
    statusLine = "🟡 BREAKEVEN";
    motivate = "Perfectly balanced! ⚖️";
  }

  await safeSend(
    chatId,
    `📊 Today — ${today}\n━━━━━━━━━━━━━━━\n💚 Income:   ${fmtUsd(income)}\n❤️ Expenses: ${fmtUsd(expense)}\n━━━━━━━━━━━━━━━\n${statusLine}\nTransactions: ${count} logged today\n${motivate}`
  );
}

async function handleWeek(chatId: number) {
  const user = await getUserByChatId(chatId);
  if (!user) { await safeSend(chatId, "Link your account first! Open the app → Settings → Connect Telegram 🔗"); return; }
  const account = await getUserAccount(user.id);
  if (!account) { await safeSend(chatId, "Something went wrong 😅 Try again!"); return; }

  const { income, expense, net, bestDay, bestNet, toughDay, toughNet } = await getWeekSummary(account.id);

  let lines = `📅 This Week\n━━━━━━━━━━━━━━━\n💚 Income:   ${fmtUsd(income)}\n❤️ Expenses: ${fmtUsd(expense)}\n━━━━━━━━━━━━━━━\n${netLine(net)}`;
  if (bestDay) lines += `\n🏆 Best day: ${bestDay} (+${fmtUsd(bestNet)})`;
  if (toughDay && toughDay !== bestDay) lines += `\n📉 Toughest: ${toughDay} (-${fmtUsd(Math.abs(toughNet))})`;
  lines += "\n\nKeep it up! 💪";

  await safeSend(chatId, lines);
}

async function handleReminders(chatId: number) {
  const user = await getUserByChatId(chatId);
  if (!user) { await safeSend(chatId, "Link your account first! Open the app → Settings → Connect Telegram 🔗"); return; }

  await safeSend(chatId, "How often should I remind you? 🎯", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🌅 Daily", callback_data: "remind_daily" },
          { text: "📅 Every 3 days", callback_data: "remind_every_3_days" },
        ],
        [
          { text: "📆 Weekly", callback_data: "remind_weekly" },
          { text: "🔕 Off", callback_data: "remind_off" },
        ],
      ],
    },
  });
}

async function handleHelp(chatId: number) {
  await safeSend(
    chatId,
    `💡 What I can do for you:\n\n💰 /add income [amount] [currency] [note] — Log money coming in\n💸 /add expense [amount] [currency] [note] — Log money going out\n📊 /summary — Today's financial snapshot\n📅 /week — This week's performance\n⚙️ /reminders — Change how often I check in\n❓ /help — Show this menu\n\nPro tip: Just send me a number like *5000* and I'll guide you! 🚀`
  );
}

async function handleBareNumber(chatId: number, amount: number) {
  const user = await getUserByChatId(chatId);
  if (!user) { await safeSend(chatId, "Link your account first! Open the app → Settings → Connect Telegram 🔗"); return; }

  await setSession(user.id, "awaiting_type", { amount });

  await safeSend(chatId, `Got ${user.home_currency} ${amount.toLocaleString()}! What was this?`, {
    reply_markup: {
      inline_keyboard: [[
        { text: "💰 Income", callback_data: `classify_income_${amount}` },
        { text: "💸 Expense", callback_data: `classify_expense_${amount}` },
      ]],
    },
  });
}

// ─── callback query handler ───────────────────────────────────────────────────

async function handleCallbackQuery(query: TelegramBot.CallbackQuery) {
  const chatId = query.message?.chat.id;
  if (!chatId) return;
  const data = query.data ?? "";

  await bot!.answerCallbackQuery(query.id);

  if (data.startsWith("remind_")) {
    const freq = data.replace("remind_", "");
    const user = await getUserByChatId(chatId);
    if (!user) { await safeSend(chatId, "Link your account first!"); return; }

    const labels: Record<string, string> = {
      daily: "daily 🌅",
      every_3_days: "every 3 days 📅",
      weekly: "weekly 📆",
      off: "never 🔕",
    };

    await db.update(usersTable).set({ notification_frequency: freq }).where(eq(usersTable.id, user.id));
    await safeSend(chatId, `✅ Got it! I'll remind you ${labels[freq] ?? freq} 🎯`);
    return;
  }

  if (data.startsWith("classify_income_") || data.startsWith("classify_expense_")) {
    const user = await getUserByChatId(chatId);
    if (!user) return;
    const account = await getUserAccount(user.id);
    if (!account) { await safeSend(chatId, "Something went wrong 😅 Try again!"); return; }

    const type: "income" | "expense" = data.startsWith("classify_income_") ? "income" : "expense";
    const amountStr = data.replace(`classify_${type}_`, "");
    const amount = parseFloat(amountStr);

    if (isNaN(amount)) { await safeSend(chatId, "Something went wrong 😅 Try again!"); return; }

    try {
      const { amount_usd, actualCurrency } = await logTransaction(user, account, type, amount, user.home_currency, "");
      const { income, expense, net } = await getDaySummary(account.id);
      const emoji = type === "income" ? "💰" : "💸";
      const label = type === "income" ? "Income logged!" : "Expense logged!";
      await clearSession(user.id);

      await safeSend(
        chatId,
        `✅ ${label} ${emoji}\n${actualCurrency} ${amount.toLocaleString()} = ${fmtUsd(amount_usd)} USD\n━━━━━━━━━━━━━\n📊 Today:\n💚 Income: ${fmtUsd(income)}\n❤️ Expenses: ${fmtUsd(expense)}\n${netLine(net)}\n━━━━━━━━━━━━━\n${motiveLine(net, type)}`
      );
    } catch (err) {
      logger.error({ err }, "classify callback error");
      await safeSend(chatId, "Something went wrong 😅 Try again!");
    }
    return;
  }

  if (data === "alldone") {
    const user = await getUserByChatId(chatId);
    if (!user) return;
    const account = await getUserAccount(user.id);
    if (!account) { await safeSend(chatId, "Something went wrong 😅 Try again!"); return; }

    const { income, expense, net, count } = await getDaySummary(account.id);
    await safeSend(
      chatId,
      `Perfect! 🎉 Final summary for today:\n━━━━━━━━━━━━━━━\n💚 Income:   ${fmtUsd(income)}\n❤️ Expenses: ${fmtUsd(expense)}\n${netLine(net)}\nTransactions: ${count}\n━━━━━━━━━━━━━━━\nRest well, money boss! 🌙💰`
    );
    return;
  }

  if (data === "log_income" || data === "log_expense") {
    const type = data === "log_income" ? "income" : "expense";
    await safeSend(chatId, `Send me: /add ${type} [amount] [currency] [note]\nExample: /add ${type} 5000 NGN freelance`);
    return;
  }

  if (data === "yesterday_summary") {
    const user = await getUserByChatId(chatId);
    if (!user) return;
    const account = await getUserAccount(user.id);
    if (!account) return;

    const yesterday = todayUTC();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const { income, expense, net } = await getDaySummary(account.id, yesterday);

    await safeSend(
      chatId,
      `📊 Yesterday\n━━━━━━━━━━━━━━━\n💚 Income:   ${fmtUsd(income)}\n❤️ Expenses: ${fmtUsd(expense)}\n${netLine(net)}`
    );
    return;
  }
}

// ─── scheduled reminder helpers ───────────────────────────────────────────────

async function getYesterdaySummaryForUser(userId: string) {
  const account = await getUserAccount(userId);
  if (!account) return null;
  const yesterday = todayUTC();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return getDaySummary(account.id, yesterday);
}

async function getTodaySummaryForUser(userId: string) {
  const account = await getUserAccount(userId);
  if (!account) return null;
  return getDaySummary(account.id);
}

function shouldSendToday(freq: string): boolean {
  const day = new Date().getUTCDay();
  if (freq === "daily") return true;
  if (freq === "weekly") return day === 0;
  if (freq === "every_3_days") return day === 1 || day === 3 || day === 5;
  return false;
}

export async function sendMorningReminders() {
  if (!bot) return;
  try {
    const users = await db
      .select()
      .from(usersTable)
      .where(isNotNull(usersTable.telegram_chat_id));

    for (const user of users) {
      if (!user.telegram_chat_id) continue;
      if (user.notification_frequency === "off") continue;
      if (!shouldSendToday(user.notification_frequency)) continue;

      const chatId = Number(user.telegram_chat_id);
      const yest = await getYesterdaySummaryForUser(user.id);

      let contextLine = "New day, new money moves! 💰";
      if (yest && yest.count > 0) {
        contextLine = yest.net >= 0
          ? `Yesterday you made +${fmtUsd(yest.net)} profit 🔥 Beat it today!`
          : `Yesterday was tough 💪 Today is a fresh start!`;
      }

      await safeSend(chatId, `🌅 Good morning ${user.name}!\n${contextLine}\n\nReady to track today? 👇`, {
        reply_markup: {
          inline_keyboard: [[
            { text: "💰 Log Income", callback_data: "log_income" },
            { text: "💸 Log Expense", callback_data: "log_expense" },
            { text: "📊 Yesterday", callback_data: "yesterday_summary" },
          ]],
        },
      });
    }
  } catch (err) {
    logger.error({ err }, "Morning reminder error");
  }
}

export async function sendEveningReminders() {
  if (!bot) return;
  try {
    const users = await db
      .select()
      .from(usersTable)
      .where(isNotNull(usersTable.telegram_chat_id));

    for (const user of users) {
      if (!user.telegram_chat_id) continue;
      if (user.notification_frequency === "off") continue;
      if (!shouldSendToday(user.notification_frequency)) continue;

      const chatId = Number(user.telegram_chat_id);
      const today = await getTodaySummaryForUser(user.id);

      if (today && today.count > 0) {
        await safeSend(
          chatId,
          `🌙 Evening wrap-up ${user.name}!\nToday: Income ${fmtUsd(today.income)} · ${netLine(today.net)}\n\nAnything else to add?`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: "💰 Add Income", callback_data: "log_income" },
                { text: "💸 Add Expense", callback_data: "log_expense" },
                { text: "✅ All done", callback_data: "alldone" },
              ]],
            },
          }
        );
      } else {
        await safeSend(
          chatId,
          `🌙 Hey ${user.name}! 👀\nYou haven't logged anything today yet...\nDon't let the day slip by! Quick log 👇`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: "💰 Add Income", callback_data: "log_income" },
                { text: "💸 Add Expense", callback_data: "log_expense" },
                { text: "✅ All done", callback_data: "alldone" },
              ]],
            },
          }
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "Evening reminder error");
  }
}

// ─── bot initialization ───────────────────────────────────────────────────────

export function startTelegramBot() {
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
    return;
  }

  bot = new TelegramBot(token, { polling: true });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim() ?? "";

    try {
      if (text === "/start") { await handleStart(chatId); return; }
      if (text.startsWith("/link ")) { await handleLink(chatId, text.replace("/link ", "").trim()); return; }
      if (text.startsWith("/link")) { await handleLink(chatId, text.replace("/link", "").trim()); return; }
      if (text.startsWith("/add ")) { await handleAdd(chatId, text.replace("/add ", "").trim().split(/\s+/)); return; }
      if (text === "/summary") { await handleSummary(chatId); return; }
      if (text === "/week") { await handleWeek(chatId); return; }
      if (text === "/reminders") { await handleReminders(chatId); return; }
      if (text === "/help") { await handleHelp(chatId); return; }

      const bareNum = parseFloat(text.replace(/[,_]/g, ""));
      if (!isNaN(bareNum) && bareNum > 0 && /^\d[\d,._]*$/.test(text)) {
        await handleBareNumber(chatId, bareNum);
        return;
      }

      const user = await getUserByChatId(chatId);
      if (!user) {
        await safeSend(chatId, "Link your account first! Open the app → Settings → Connect Telegram 🔗");
        return;
      }

      await safeSend(chatId, `I didn't understand that 🤔\nSend /help to see what I can do!`);
    } catch (err) {
      logger.error({ err }, "Telegram message handler error");
      await safeSend(chatId, "Something went wrong 😅 Try again!");
    }
  });

  bot.on("callback_query", async (query) => {
    try {
      await handleCallbackQuery(query);
    } catch (err) {
      logger.error({ err }, "Telegram callback query error");
    }
  });

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });

  logger.info("✅ Telegram bot is live!");
  console.log("✅ Telegram bot is live!");
}

export function getBotInstance() {
  return bot;
}
