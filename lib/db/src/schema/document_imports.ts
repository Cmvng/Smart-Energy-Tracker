import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const documentImportsTable = pgTable("document_imports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  filename: text("filename"),
  file_type: text("file_type"),
  status: text("status").notNull().default("pending"),
  total_found: integer("total_found").notNull().default(0),
  total_imported: integer("total_imported").notNull().default(0),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export type DocumentImport = typeof documentImportsTable.$inferSelect;
