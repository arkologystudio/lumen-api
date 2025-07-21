// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import { AuthPayload, User } from "../types/index";
import { verifyUserToken } from "../services/userService";

// Legacy interface for backward compatibility
export interface LegacyAuthPayload {
  jti: string;
}

// Extended Request type for user authentication
export interface AuthenticatedRequest extends Request {
  user?: User;
  auth?: AuthPayload;
}

// Legacy JWT authentication (for backward compatibility)
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
    const payload = jwt.verify(
      h[1],
      String(ENV.JWT_SECRET)
    ) as LegacyAuthPayload;
    (req as any).auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// New user authentication middleware
export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const h = req.headers.authorization?.split(" ");
  if (h?.[0] !== "Bearer" || !h[1]) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const user = await verifyUserToken(h[1]);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// API key authentication (unchanged)
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
