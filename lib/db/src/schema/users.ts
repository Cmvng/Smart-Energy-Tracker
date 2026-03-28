import { pgTable, text, timestamp, varchar, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password_hash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  mode: varchar("mode", { length: 20 }).notNull().default("individual"),
  home_currency: varchar("home_currency", { length: 10 }).notNull().default("USD"),
  notification_frequency: varchar("notification_frequency", { length: 20 }).notNull().default("daily"),
  telegram_chat_id: text("telegram_chat_id"),
  avatar_url: text("avatar_url"),
  nickname: text("nickname"),
  is_admin: boolean("is_admin").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, created_at: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
