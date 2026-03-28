import cors from "cors";
import express from "express";
import { registerModuleRoutes } from "./modules/index.js";
import { authRoutes } from "./modules/auth/auth.routes.js";

/**
 * Parses `AUTH_RATE_LIMIT_MAX` for express-rate-limit.
 * Returns a safe positive integer; falls back when the value is missing, non-numeric, not finite, or less than 1.
 */
export function getAuthRateLimitMax(): number {
  const fallback = 100;
  const raw = process.env.AUTH_RATE_LIMIT_MAX;
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const n = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 1) {
    return fallback;
  }
  return n;
}

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "cs-manager-server" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api", registerModuleRoutes());

  return app;
};
