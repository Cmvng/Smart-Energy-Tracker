import { Router, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin, AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/stats", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const countsResult = await db.execute<{
      total_users: string;
      new_today: string;
      new_this_week: string;
      total_transactions: string;
      transactions_today: string;
      active_today: string;
    }>(sql`
      SELECT
        (SELECT COUNT(*)::text FROM users) as total_users,
        (SELECT COUNT(*)::text FROM users WHERE created_at >= CURRENT_DATE) as new_today,
        (SELECT COUNT(*)::text FROM users WHERE created_at >= NOW() - INTERVAL '7 days') as new_this_week,
        (SELECT COUNT(*)::text FROM transactions WHERE deleted_at IS NULL) as total_transactions,
        (SELECT COUNT(*)::text FROM transactions WHERE deleted_at IS NULL AND created_at >= CURRENT_DATE) as transactions_today,
        (SELECT COUNT(DISTINCT a.user_id)::text FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE t.deleted_at IS NULL AND t.created_at >= CURRENT_DATE) as active_today
    `);

    const counts = countsResult.rows[0];

    const currencyResult = await db.execute<{ home_currency: string; count: string }>(sql`
      SELECT home_currency, COUNT(*)::text as count
      FROM users
      GROUP BY home_currency
      ORDER BY COUNT(*) DESC
    `);

    const signupsResult = await db.execute(sql`
      SELECT u.id, u.name, u.email, u.nickname, u.mode, u.home_currency, u.created_at,
             (u.telegram_chat_id IS NOT NULL) as telegram_connected,
             COUNT(t.id)::text as transaction_count
      FROM users u
      LEFT JOIN accounts a ON a.user_id = u.id
      LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT 20
    `);

    res.json({
      total_users: parseInt(counts.total_users),
      new_today: parseInt(counts.new_today),
      new_this_week: parseInt(counts.new_this_week),
      total_transactions: parseInt(counts.total_transactions),
      transactions_today: parseInt(counts.transactions_today),
      active_today: parseInt(counts.active_today),
      users_by_currency: currencyResult.rows.map((r) => ({
        home_currency: r.home_currency,
        count: parseInt(r.count),
      })),
      recent_signups: signupsResult.rows,
    });
  } catch (err) {
    req.log.error({ err }, "Admin stats error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.get("/users", requireAdmin, async (req: AuthRequest, res: Response) => {
  const search = (req.query.search as string) || "";
  try {
    const usersResult = search
      ? await db.execute(sql`
          SELECT u.id, u.name, u.email, u.nickname, u.mode, u.home_currency, u.created_at, u.is_admin,
                 (u.telegram_chat_id IS NOT NULL) as telegram_connected,
                 COUNT(t.id)::text as transaction_count
          FROM users u
          LEFT JOIN accounts a ON a.user_id = u.id
          LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL
          WHERE u.name ILIKE ${"%" + search + "%"} OR u.email ILIKE ${"%" + search + "%"}
          GROUP BY u.id ORDER BY u.created_at DESC
        `)
      : await db.execute(sql`
          SELECT u.id, u.name, u.email, u.nickname, u.mode, u.home_currency, u.created_at, u.is_admin,
                 (u.telegram_chat_id IS NOT NULL) as telegram_connected,
                 COUNT(t.id)::text as transaction_count
          FROM users u
          LEFT JOIN accounts a ON a.user_id = u.id
          LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL
          GROUP BY u.id ORDER BY u.created_at DESC
        `);
    res.json(usersResult.rows);
  } catch (err) {
    req.log.error({ err }, "Admin users error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.get("/feedback", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const feedbackResult = await db.execute(sql`
      SELECT f.*, u.name as user_name, u.email as user_email
      FROM feedback f
      LEFT JOIN users u ON u.id = f.user_id
      ORDER BY f.created_at DESC
    `);
    res.json(feedbackResult.rows);
  } catch (err) {
    req.log.error({ err }, "Admin feedback error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

export default router;
