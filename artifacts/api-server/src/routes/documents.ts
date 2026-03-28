import { Router, Response } from "express";
import multer from "multer";
import { db, pool } from "@workspace/db";
import { documentImportsTable, transactionsTable, accountsTable, currenciesTable } from "@workspace/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { detectAndParse, OcrProgress } from "../document-parser";

const router = Router();

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const lc = file.originalname.toLowerCase();
    const ext = lc.slice(lc.lastIndexOf("."));
    const ok = lc.endsWith(".pdf") || lc.endsWith(".csv") ||
      IMAGE_EXTS.has(ext) ||
      file.mimetype.includes("pdf") || file.mimetype.includes("csv") ||
      file.mimetype === "text/plain" || file.mimetype.startsWith("image/");
    if (ok) cb(null, true);
    else cb(new Error("WRONG_TYPE"));
  },
});

// ── Shared: duplicate-check and format the final upload response ──────────────
async function buildUploadResponse(
  result: Awaited<ReturnType<typeof detectAndParse>>,
  importRecord: any,
  filename: string,
  fileType: string,
  userId: string
) {
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.user_id, userId));
  const txsWithDupes = await Promise.all(
    (result.transactions || []).map(async (tx) => {
      if (!account) return { ...tx, is_duplicate: false };
      const { rows } = await pool.query<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM transactions
         WHERE account_id = $1 AND deleted_at IS NULL
           AND DATE(transacted_at) = $2
           AND ABS(amount_original::numeric - $3::numeric) < 0.01
           AND type = $4`,
        [account.id, tx.date, tx.amount, tx.type]
      );
      return { ...tx, is_duplicate: parseInt(rows[0]?.cnt ?? "0", 10) > 0 };
    })
  );
  await db.update(documentImportsTable)
    .set({ status: "parsed", total_found: txsWithDupes.length })
    .where(eq(documentImportsTable.id, importRecord.id));

  return {
    import_id: importRecord.id,
    filename,
    file_type: fileType,
    transactions: txsWithDupes,
    count: txsWithDupes.length,
    duplicate_count: txsWithDupes.filter((t) => t.is_duplicate).length,
    bank: result.bank,
    detected_currency: result.detected_currency,
    parse_method: result.parse_method,
    skipped: result.skipped ?? 0,
    warning: result.warning,
  };
}

router.post("/upload", requireAuth, (req: AuthRequest, res: Response) => {
  upload.single("document")(req as any, res as any, async (err: any) => {
    if (err) {
      if (err.message === "WRONG_TYPE") {
        res.status(400).json({ error: "Only PDF and CSV files are supported." });
      } else if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "File is too large. Maximum size is 10MB." });
      } else {
        res.status(400).json({ error: err.message || "Upload failed" });
      }
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file provided." });
      return;
    }

    const filename = req.file.originalname;
    const lc2 = filename.toLowerCase();
    const ext2 = lc2.slice(lc2.lastIndexOf("."));
    const fileType = lc2.endsWith(".pdf") ? "pdf"
      : IMAGE_EXTS.has(ext2) ? "image"
      : "csv";
    // PDFs and images both go through AI, so stream SSE for both
    const useSSE = fileType === "pdf" || fileType === "image";

    let importRecord: any;
    try {
      const [rec] = await db.insert(documentImportsTable).values({
        user_id: req.userId!,
        filename,
        file_type: fileType,
        status: "processing",
      }).returning();
      importRecord = rec;
    } catch {
      res.status(500).json({ error: "Could not create import record." });
      return;
    }

    // ── PDF/Image → stream SSE events so frontend can show live progress ─────
    if (useSSE) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const sendEvent = (data: object) =>
        res.write(`data: ${JSON.stringify(data)}\n\n`);

      const onProgress = (evt: OcrProgress) => sendEvent(evt);

      try {
        const result = await detectAndParse(req.file.buffer, filename, req.file.mimetype, onProgress);

        if (result.locked) {
          await db.update(documentImportsTable).set({ status: "failed" }).where(eq(documentImportsTable.id, importRecord.id));
          sendEvent({ type: "locked", pageCount: result.pageCount ?? 1 });
          res.end();
          return;
        }

        if (result.error || !result.transactions) {
          await db.update(documentImportsTable).set({ status: "failed" }).where(eq(documentImportsTable.id, importRecord.id));
          sendEvent({ type: "error", message: result.error || "Parse failed" });
          res.end();
          return;
        }

        const payload = await buildUploadResponse(result, importRecord, filename, fileType, req.userId!);
        sendEvent({ type: "result", ...payload });
        res.end();
      } catch (e: any) {
        await db.update(documentImportsTable).set({ status: "failed" }).where(eq(documentImportsTable.id, importRecord.id));
        sendEvent({ type: "error", message: "Upload failed unexpectedly." });
        res.end();
      }
      return;
    }

    // ── CSV → standard JSON response ──────────────────────────────────────────
    const result = await detectAndParse(req.file.buffer, filename, req.file.mimetype);

    if (result.locked) {
      await db.update(documentImportsTable).set({ status: "failed" }).where(eq(documentImportsTable.id, importRecord.id));
      res.status(200).json({ locked: true });
      return;
    }

    if (result.error || !result.transactions) {
      await db.update(documentImportsTable).set({ status: "failed" }).where(eq(documentImportsTable.id, importRecord.id));
      res.status(400).json({ error: result.error || "Parse failed" });
      return;
    }

    const payload = await buildUploadResponse(result, importRecord, filename, fileType, req.userId!);
    res.json(payload);
  });
});

router.post("/confirm", requireAuth, async (req: AuthRequest, res: Response) => {
  const { import_id, transactions } = req.body;
  if (!import_id || !Array.isArray(transactions) || transactions.length === 0) {
    res.status(400).json({ error: "import_id and transactions[] are required." });
    return;
  }

  try {
    const [account] = await db.select().from(accountsTable).where(eq(accountsTable.user_id, req.userId!));
    if (!account) {
      res.status(404).json({ error: "No account found for this user." });
      return;
    }

    let totalIncomeUsd = 0;
    let totalExpenseUsd = 0;
    let imported = 0;

    for (const tx of transactions) {
      const currency = (tx.currency || "USD").toUpperCase();
      const rows = await db.select().from(currenciesTable).where(eq(currenciesTable.code, currency));
      const rate = rows[0] ? parseFloat(rows[0].rate_to_usd) : 1.0;
      const amountUsd = parseFloat(tx.amount) * rate;

      const txDate = tx.date ? new Date(tx.date) : new Date();

      await db.insert(transactionsTable).values({
        account_id: account.id,
        type: tx.type,
        amount_original: String(parseFloat(tx.amount).toFixed(2)),
        currency_code: currency,
        amount_usd: String(amountUsd.toFixed(2)),
        fx_rate_used: String(rate.toFixed(8)),
        notes: tx.description || null,
        transacted_at: txDate,
        import_id,
      });

      if (tx.type === "income") totalIncomeUsd += amountUsd;
      else totalExpenseUsd += amountUsd;
      imported++;
    }

    await db.update(documentImportsTable).set({
      status: "completed",
      total_imported: imported,
    }).where(eq(documentImportsTable.id, import_id));

    res.json({
      imported,
      summary: {
        total_income_usd: parseFloat(totalIncomeUsd.toFixed(2)),
        total_expense_usd: parseFloat(totalExpenseUsd.toFixed(2)),
        net_usd: parseFloat((totalIncomeUsd - totalExpenseUsd).toFixed(2)),
      },
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "Confirm import error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/history", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const imports = await db.select().from(documentImportsTable)
      .where(eq(documentImportsTable.user_id, req.userId!))
      .orderBy(documentImportsTable.created_at);
    res.json(imports.reverse());
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const [imp] = await db.select().from(documentImportsTable)
      .where(and(eq(documentImportsTable.id, id), eq(documentImportsTable.user_id, req.userId!)));
    if (!imp) {
      res.status(404).json({ error: "Import not found." });
      return;
    }

    await pool.query(`UPDATE transactions SET deleted_at = NOW() WHERE import_id = $1`, [id]);
    await db.delete(documentImportsTable).where(eq(documentImportsTable.id, id));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
