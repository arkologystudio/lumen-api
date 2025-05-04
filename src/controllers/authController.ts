import { RequestHandler } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { ENV } from "../config/env";

// Parse and validate JWT expiration value
const parseJwtExpiration = (value: string): number => {
  // If numeric string, convert to seconds as number
  if (/^\d+$/.test(value)) {
    return parseInt(value, 10);
  }

  // Default to 1 hour in seconds
  return 3600;
};

export const generateToken: RequestHandler = async (req, res) => {
  try {
    // Issue a one-time JWT with a jti so we can rate-limit per-token
    const jti = uuidv4();

    // Handle JWT TTL properly with type safety - use seconds
    const jwtTtlStr = String(ENV.JWT_TTL);
    const options: SignOptions = {
      expiresIn: parseJwtExpiration(jwtTtlStr),
    };

    const token = jwt.sign(
      { jti },
      Buffer.from(String(ENV.JWT_SECRET)),
      options
    );
    res.json({ token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
};
