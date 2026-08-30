import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const configuredOrigins = (process.env.APP_URL ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || process.env.NODE_ENV !== "production") {
        callback(null, true);
        return;
      }
      callback(null, configuredOrigins.includes(origin.replace(/\/$/, "")));
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.disable("x-powered-by");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limit", message: "Too many requests, please try again later." },
});

app.use("/api", limiter);
app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const frontendDir = path.resolve(currentDir, "../../smart-ine-tracker/dist/public");

  app.use(express.static(frontendDir, { maxAge: "1h", index: false }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/") || !req.accepts("html")) {
      next();
      return;
    }
    res.sendFile(path.join(frontendDir, "index.html"));
  });
}

export default app;
