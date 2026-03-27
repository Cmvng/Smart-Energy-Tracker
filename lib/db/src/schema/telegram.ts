import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const telegramLinkCodesTable = pgTable("telegram_link_codes", {
  code: text("code").primaryKey(),
  user_id: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  expires_at: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
});

export const telegramSessionsTable = pgTable("telegram_sessions", {
  user_id: text("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  state: text("state").notNull().default("idle"),
  data: jsonb("data"),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export type TelegramLinkCode = typeof telegramLinkCodesTable.$inferSelect;
export type TelegramSession = typeof telegramSessionsTable.$inferSelect;
