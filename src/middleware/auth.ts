// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import { User, License } from "../types/index";
import { verifyUserToken } from "../services/userService";
import { prisma } from "../config/database";
import crypto from "crypto";

// Legacy interface for backward compatibility
export interface LegacyAuthPayload {
  jti: string;
}

// Extended Request type for user authentication
export interface AuthenticatedRequest extends Request {
  user?: User;
  license?: License;
  apiKey?: {
    id: string;
    user_id: string;
    scopes: string[];
    name: string;
  };
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

// Helper function to hash API keys
const hashApiKey = (key: string): string => {
  return crypto.createHash('sha256').update(key).digest('hex');
};

// Admin-only authentication middleware
export const adminKeyAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const key =
    req.header("x-admin-key")?.trim() ||
    req.header("x-api-key")?.trim() ||
    (typeof req.query.admin_key === "string" ? req.query.admin_key : "") ||
    (typeof req.query.api_key === "string" ? req.query.api_key : "");

  if (!key || !compareAdminKey(key)) {
    res.status(401).json({ 
      error: "Invalid or missing admin API key",
      message: "Admin access requires a valid admin API key. Use 'x-admin-key' header or 'admin_key' query parameter."
    });
    return;
  }
  next();
};

// Scoped API key authentication using database
export const scopedApiKeyAuth = (requiredScopes: string[] = []) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const key =
      req.header("x-api-key")?.trim() ||
      (typeof req.query.api_key === "string" ? req.query.api_key : "");

    if (!key) {
      res.status(401).json({ 
        error: "Missing API key",
        message: "API key required. Use 'x-api-key' header or 'api_key' query parameter."
      });
      return;
    }

    try {
      // Hash the provided key to compare with stored hash
      const keyHash = hashApiKey(key);
      
      // Find the API key in database
      const apiKey = await prisma.apiKey.findUnique({
        where: { key_hash: keyHash },
        include: { user: true }
      });

      if (!apiKey || !apiKey.is_active) {
        res.status(401).json({ error: "Invalid or inactive API key" });
        return;
      }

      // Check if the key has required scopes
      const hasRequiredScopes = requiredScopes.every(scope => 
        apiKey.scopes.includes(scope)
      );

      if (!hasRequiredScopes) {
        res.status(403).json({ 
          error: "Insufficient permissions",
          message: `API key requires scopes: ${requiredScopes.join(', ')}`,
          current_scopes: apiKey.scopes
        });
        return;
      }

      // Update last_used_at
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { last_used_at: new Date() }
      });

      // Add API key info to request
      req.apiKey = {
        id: apiKey.id,
        user_id: apiKey.user_id,
        scopes: apiKey.scopes,
        name: apiKey.name
      };

      // Also add user if needed
      if (apiKey.user) {
        req.user = apiKey.user;
      }

      next();
    } catch (error) {
      console.error("API key validation error:", error);
      res.status(500).json({ error: "API key validation failed" });
    }
  };
};

// Legacy API key authentication (kept for backward compatibility)
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

const compareAdminKey = (key: string) => {
  return key === ENV.ADMIN_API_KEY || key === ENV.SERVER_API_KEY;
};
