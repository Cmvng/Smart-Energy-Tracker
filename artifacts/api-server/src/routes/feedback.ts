import { Router, Response } from "express";
import { db } from "@workspace/db";
import { feedbackTable } from "@workspace/db/schema";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const { rating, message, page } = req.body;

  if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
    res.status(400).json({ error: "validation_error", message: "Rating must be 1-5" });
    return;
  }

  try {
    await db.insert(feedbackTable).values({
      user_id: req.userId!,
      rating,
      message: message ? String(message).slice(0, 1000) : null,
      page: page ? String(page).slice(0, 100) : null,
    });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Feedback error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

export default router;
