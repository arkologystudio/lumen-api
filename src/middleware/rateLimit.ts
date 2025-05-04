// src/middleware/rateLimit.ts
import rateLimit from "express-rate-limit";
import { ENV } from "../config/env";

export const searchRateLimiter = rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max: ENV.RATE_LIMIT_MAX,
  keyGenerator: (req) => {
    // Prefer token's jti; fallback to IP or default
    return ((req as any).auth?.jti as string) || req.ip || "unknown-client";
  },
  handler: (_req, res) =>
    res.status(429).json({ error: "Too many requests, slow down" }),
});
