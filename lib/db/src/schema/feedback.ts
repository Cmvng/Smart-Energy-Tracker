import { pgTable, text, timestamp, integer, uuid } from "drizzle-orm/pg-core";

export const feedbackTable = pgTable("feedback", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id"),
  rating: integer("rating").notNull(),
  message: text("message"),
  page: text("page"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export type Feedback = typeof feedbackTable.$inferSelect;
