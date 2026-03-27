import { pgTable, text, timestamp, varchar, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const analyticsSnapshotsTable = pgTable("analytics_snapshots", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  timeframe: varchar("timeframe", { length: 10 }).notNull(),
  total_income_usd: decimal("total_income_usd", { precision: 18, scale: 2 }).notNull().default("0"),
  total_expense_usd: decimal("total_expense_usd", { precision: 18, scale: 2 }).notNull().default("0"),
  net_usd: decimal("net_usd", { precision: 18, scale: 2 }).notNull().default("0"),
  period_start: timestamp("period_start").notNull(),
  period_end: timestamp("period_end").notNull(),
});

export const insertAnalyticsSnapshotSchema = createInsertSchema(analyticsSnapshotsTable).omit({ id: true });
export type InsertAnalyticsSnapshot = z.infer<typeof insertAnalyticsSnapshotSchema>;
export type AnalyticsSnapshot = typeof analyticsSnapshotsTable.$inferSelect;
