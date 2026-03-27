import { Router, Response } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

router.post("/avatar", requireAuth, upload.single("avatar"), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "validation_error", message: "No image file provided" });
      return;
    }

    const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const [updated] = await db
      .update(usersTable)
      .set({ avatar_url: b64 })
      .where(eq(usersTable.id, req.userId!))
      .returning();

    res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        mode: updated.mode,
        home_currency: updated.home_currency,
        notification_frequency: updated.notification_frequency,
        avatar_url: updated.avatar_url,
        created_at: updated.created_at,
      },
    });
  } catch (err: any) {
    if (err.message === "Only image files are allowed") {
      res.status(400).json({ error: "validation_error", message: err.message });
      return;
    }
    req.log?.error?.({ err }, "Avatar upload error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

export default router;
