import { db } from "@workspace/db";
import { currenciesTable, usersTable, accountsTable, transactionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

const CURRENCIES = [
  { code: "USD", name: "US Dollar", rate_to_usd: "1.0" },
  { code: "EUR", name: "Euro", rate_to_usd: "0.92" },
  { code: "GBP", name: "British Pound", rate_to_usd: "0.79" },
  { code: "NGN", name: "Nigerian Naira", rate_to_usd: "0.00065" },
  { code: "KES", name: "Kenyan Shilling", rate_to_usd: "0.0077" },
  { code: "GHS", name: "Ghanaian Cedi", rate_to_usd: "0.068" },
  { code: "ZAR", name: "South African Rand", rate_to_usd: "0.054" },
  { code: "INR", name: "Indian Rupee", rate_to_usd: "0.012" },
  { code: "CAD", name: "Canadian Dollar", rate_to_usd: "0.74" },
  { code: "AUD", name: "Australian Dollar", rate_to_usd: "0.65" },
  { code: "JPY", name: "Japanese Yen", rate_to_usd: "0.0067" },
  { code: "CNY", name: "Chinese Yuan", rate_to_usd: "0.14" },
  { code: "BRL", name: "Brazilian Real", rate_to_usd: "0.20" },
  { code: "MXN", name: "Mexican Peso", rate_to_usd: "0.058" },
  { code: "AED", name: "UAE Dirham", rate_to_usd: "0.27" },
  { code: "SAR", name: "Saudi Riyal", rate_to_usd: "0.27" },
  { code: "PKR", name: "Pakistani Rupee", rate_to_usd: "0.0036" },
  { code: "EGP", name: "Egyptian Pound", rate_to_usd: "0.032" },
  { code: "TZS", name: "Tanzanian Shilling", rate_to_usd: "0.00039" },
  { code: "CHF", name: "Swiss Franc", rate_to_usd: "1.10" },
];

export async function seedCurrencies() {
  try {
    for (const c of CURRENCIES) {
      await db
        .insert(currenciesTable)
        .values(c)
        .onConflictDoUpdate({
          target: currenciesTable.code,
          set: { name: c.name, rate_to_usd: c.rate_to_usd },
        });
    }
    console.log(`Currencies seeded (${CURRENCIES.length} entries)`);
  } catch (err) {
    console.error("Error seeding currencies:", err);
  }
}

const DEMO_EMAIL = "demo@ine.app";
const DEMO_PASSWORD = "Demo1234!";

const SAMPLE_TRANSACTIONS = [
  { type: "income", amount: 850, currency: "USD", notes: "Freelance payment", daysAgo: 0 },
  { type: "expense", amount: 45.50, currency: "USD", notes: "Groceries", daysAgo: 0 },
  { type: "income", amount: 1200, currency: "USD", notes: "Client invoice", daysAgo: 1 },
  { type: "expense", amount: 12.00, currency: "USD", notes: "Transport", daysAgo: 1 },
  { type: "expense", amount: 18.50, currency: "USD", notes: "Lunch", daysAgo: 2 },
  { type: "income", amount: 500, currency: "USD", notes: "Consulting fee", daysAgo: 3 },
  { type: "expense", amount: 95.00, currency: "USD", notes: "Electricity bill", daysAgo: 3 },
  { type: "expense", amount: 25.00, currency: "USD", notes: "Coffee & snacks", daysAgo: 4 },
  { type: "income", amount: 320, currency: "USD", notes: "Side project payment", daysAgo: 5 },
  { type: "expense", amount: 60.00, currency: "USD", notes: "Internet bill", daysAgo: 6 },
];

export async function seedDemoUser() {
  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, DEMO_EMAIL));
    if (existing.length > 0) {
      console.log("Demo user already exists, checking transactions...");
      const [account] = await db.select().from(accountsTable).where(eq(accountsTable.user_id, existing[0].id));
      if (account) {
        const txCount = await db
          .select({ cnt: sql<number>`count(*)` })
          .from(transactionsTable)
          .where(eq(transactionsTable.account_id, account.id));
        const count = Number(txCount[0]?.cnt ?? 0);
        if (count === 0) {
          await insertSampleTransactions(account.id);
          console.log(`Added ${SAMPLE_TRANSACTIONS.length} sample transactions for demo user`);
        } else {
          console.log(`Demo user has ${count} transactions already`);
        }
      }
      return;
    }

    const password_hash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const [user] = await db.insert(usersTable).values({
      name: "Demo User",
      email: DEMO_EMAIL,
      password_hash,
      mode: "individual",
      home_currency: "USD",
    }).returning();

    const [account] = await db.insert(accountsTable).values({
      user_id: user.id,
      type: "individual",
      label: "Personal Account",
    }).returning();

    await insertSampleTransactions(account.id);

    console.log(`Demo user created: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    console.log(`Added ${SAMPLE_TRANSACTIONS.length} sample transactions`);
  } catch (err) {
    console.error("Error seeding demo user:", err);
  }
}

async function insertSampleTransactions(accountId: string) {
  const now = new Date();
  for (const tx of SAMPLE_TRANSACTIONS) {
    const txDate = new Date(now);
    txDate.setDate(txDate.getDate() - tx.daysAgo);
    txDate.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);

    await db.insert(transactionsTable).values({
      account_id: accountId,
      type: tx.type,
      amount_original: String(tx.amount),
      currency_code: tx.currency,
      amount_usd: String(tx.amount),
      fx_rate_used: "1.0",
      notes: tx.notes,
      transacted_at: txDate,
      synced: true,
    });
  }
}
