import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, accountsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { createToken, requireAuth, AuthRequest } from "../middlewares/auth";
import { Response, Request } from "express";

const router: IRouter = Router();

router.post("/register", async (req: Request, res: Response) => {
  const { name, email, password, mode, home_currency } = req.body;

  if (!name || !email || !password || !mode) {
    res.status(400).json({ error: "validation_error", message: "name, email, password, and mode are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "validation_error", message: "Password must be at least 6 characters" });
    return;
  }

  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing.length > 0) {
      res.status(409).json({ error: "conflict", message: "Email already registered" });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({
      name,
      email,
      password_hash,
      mode,
      home_currency: home_currency || "USD",
    }).returning();

    await db.insert(accountsTable).values({
      user_id: user.id,
      type: mode,
      label: mode === "business" ? "Business Account" : "Personal Account",
    });

    const token = createToken(user.id);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mode: user.mode,
        home_currency: user.home_currency,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "validation_error", message: "email and password are required" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) {
      res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
      return;
    }

    const token = createToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mode: user.mode,
        home_currency: user.home_currency,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) {
      res.status(401).json({ error: "unauthorized", message: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      mode: user.mode,
      home_currency: user.home_currency,
      created_at: user.created_at,
    });
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

export default router;
