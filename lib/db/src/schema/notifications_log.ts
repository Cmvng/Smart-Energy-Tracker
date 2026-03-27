import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const notificationsLogTable = pgTable("notifications_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull(),
  sent_at: timestamp("sent_at").notNull().defaultNow(),
  type: varchar("type", { length: 50 }).notNull().default("reminder"),
  message: text("message").notNull(),
});

export type NotificationLog = typeof notificationsLogTable.$inferSelect;
