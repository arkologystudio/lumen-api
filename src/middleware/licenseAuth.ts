/**
 * License Authentication Middleware
 * Validates user licenses for accessing licensed content
 */

import { Response, NextFunction } from "express";
import { prisma } from "../config/database";
import { AuthenticatedRequest } from "./auth";
import { validateLicense } from "../services/licenseService";

/**
 * Middleware to check if user has valid license for a plugin
 * Usage: licenseRequired('plugin-slug')
 */
export const licenseRequired = (productSlug: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
        });
        return;
      }

      // Check if user has a valid license for this product
      const licenses = await prisma.license.findMany({
        where: {
          user_id: req.user.id,
          product: {
            slug: productSlug,
          },
          is_active: true,
          status: "active",
        },
        include: {
          product: true,
        },
      });

      if (licenses.length === 0) {
        res.status(403).json({
          success: false,
          error: "Valid license required for this product",
        });
        return;
      }

      // Validate the first license found
      const license = licenses[0];
      const validatedLicense = await validateLicense(license.license_key, productSlug);

      if (!validatedLicense) {
        res.status(403).json({
          success: false,
          error: "License validation failed",
        });
        return;
      }

      // Add license info to request
      req.license = validatedLicense;
      next();
    } catch (error) {
      console.error("License validation error:", error);
      res.status(500).json({
        success: false,
        error: "License validation failed",
      });
    }
  };
};
