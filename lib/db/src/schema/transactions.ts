import { pgTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";

export const transactionsTable = pgTable("transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  account_id: text("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 10 }).notNull(),
  amount_original: decimal("amount_original", { precision: 18, scale: 2 }).notNull(),
  currency_code: varchar("currency_code", { length: 10 }).notNull(),
  amount_usd: decimal("amount_usd", { precision: 18, scale: 2 }),
  fx_rate_used: decimal("fx_rate_used", { precision: 18, scale: 8 }),
  notes: text("notes"),
  transacted_at: timestamp("transacted_at").notNull().defaultNow(),
  synced: boolean("synced").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, created_at: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
