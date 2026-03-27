import { pgTable, varchar, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const currenciesTable = pgTable("currencies", {
  code: varchar("code", { length: 10 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  rate_to_usd: decimal("rate_to_usd", { precision: 18, scale: 8 }).notNull(),
  rate_updated_at: timestamp("rate_updated_at").notNull().defaultNow(),
});

export const insertCurrencySchema = createInsertSchema(currenciesTable);
export type InsertCurrency = z.infer<typeof insertCurrencySchema>;
export type Currency = typeof currenciesTable.$inferSelect;
