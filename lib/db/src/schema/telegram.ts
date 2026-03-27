import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const telegramSessionsTable = pgTable("telegram_sessions", {
  user_id: text("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  state: text("state").notNull().default("idle"),
  data: jsonb("data"),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export type TelegramSession = typeof telegramSessionsTable.$inferSelect;
