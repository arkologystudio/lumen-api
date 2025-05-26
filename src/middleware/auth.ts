// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";

export interface AuthPayload {
  jti: string;
}

export const authenticateJWT = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.log("authenticateJWT", req.headers.authentication);
  const h = req.headers.authorization?.split(" ");
  if (h?.[0] !== "Bearer" || !h[1]) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  try {
    const payload = jwt.verify(h[1], String(ENV.JWT_SECRET)) as AuthPayload;
    (req as any).auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const apiKeyAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const key =
    req.header("x-api-key")?.trim() ||
    (typeof req.query.api_key === "string" ? req.query.api_key : "");
  if (!key || !compareApiKey(key)) {
    res.status(401).json({ error: "Invalid or missing API key" });
    return;
  }
  next();
};

const compareApiKey = (key: string) => {
  return key === ENV.SERVER_API_KEY;
};
