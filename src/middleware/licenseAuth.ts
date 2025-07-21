/**
 * License Authentication Middleware
 * Validates user licenses for accessing licensed content
 */

import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";
import { validateLicense } from "../services/licenseService";
import { getPluginById } from "../services/pluginService";

// Extended request type for license validation
export interface LicenseAuthenticatedRequest extends AuthenticatedRequest {
  validatedLicense?: {
    license_key: string;
    plugin_id: string;
    user_id: string;
    download_allowed: boolean;
  };
}

/**
 * Middleware to validate license from request headers or body
 * Expects license_key and plugin_id in headers or body
 */
export const validateLicenseMiddleware = async (
  req: LicenseAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "User authentication required",
      });
      return;
    }

    // Get license key and plugin ID from headers or body
    const licenseKey =
      (req.headers["x-license-key"] as string) ||
      req.body.license_key ||
      (req.query.license_key as string);

    const pluginId =
      (req.headers["x-plugin-id"] as string) ||
      req.body.plugin_id ||
      (req.query.plugin_id as string) ||
      req.params.plugin_id;

    if (!licenseKey) {
      res.status(400).json({
        success: false,
        error:
          "License key is required (x-license-key header, license_key in body/query)",
      });
      return;
    }

    if (!pluginId) {
      res.status(400).json({
        success: false,
        error:
          "Plugin ID is required (x-plugin-id header, plugin_id in body/query/params)",
      });
      return;
    }

    // Validate the license
    const validation = await validateLicense({
      license_key: licenseKey,
      plugin_id: pluginId,
    });

    if (!validation.valid) {
      res.status(403).json({
        success: false,
        error: validation.message || "Invalid license",
      });
      return;
    }

    if (!validation.license) {
      res.status(403).json({
        success: false,
        error: "License information not available",
      });
      return;
    }

    // Verify the user owns this license
    if (validation.license.user_id !== req.user.id) {
      res.status(403).json({
        success: false,
        error: "License does not belong to authenticated user",
      });
      return;
    }

    // Add validated license info to request
    req.validatedLicense = {
      license_key: licenseKey,
      plugin_id: pluginId,
      user_id: req.user.id,
      download_allowed: validation.download_allowed,
    };

    next();
  } catch (error) {
    console.error("License validation middleware error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to validate license",
    });
  }
};

/**
 * Middleware to check if user has any active license for a specific plugin
 * Only requires plugin_id parameter
 */
export const requirePluginLicense = (pluginId?: string) => {
  return async (
    req: LicenseAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "User authentication required",
        });
        return;
      }

      // Get plugin ID from parameter, route params, or headers
      const targetPluginId =
        pluginId ||
        req.params.plugin_id ||
        (req.headers["x-plugin-id"] as string) ||
        req.body.plugin_id ||
        (req.query.plugin_id as string);

      if (!targetPluginId) {
        res.status(400).json({
          success: false,
          error: "Plugin ID is required",
        });
        return;
      }

      // Verify plugin exists and is active
      const plugin = await getPluginById(targetPluginId);
      if (!plugin) {
        res.status(404).json({
          success: false,
          error: "Plugin not found",
        });
        return;
      }

      if (!plugin.is_active) {
        res.status(400).json({
          success: false,
          error: "Plugin is not available",
        });
        return;
      }

      // Check if plugin is public (no license required)
      if (plugin.is_public) {
        next();
        return;
      }

      // Check if user has a valid license for this plugin
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      const license = await prisma.license.findFirst({
        where: {
          user_id: req.user.id,
          plugin_id: targetPluginId,
          status: "active",
          is_active: true,
        },
      });

      if (!license) {
        res.status(403).json({
          success: false,
          error: "Valid license required for this plugin",
          plugin: {
            id: plugin.id,
            name: plugin.name,
            product: plugin.product?.name,
          },
        });
        return;
      }

      // Check if license has expired
      if (license.expires_at && new Date() > license.expires_at) {
        res.status(403).json({
          success: false,
          error: "License has expired",
          license: {
            license_key: license.license_key,
            expires_at: license.expires_at.toISOString(),
          },
        });
        return;
      }

      // Add license info to request for use in controllers
      req.validatedLicense = {
        license_key: license.license_key,
        plugin_id: targetPluginId,
        user_id: req.user.id,
        download_allowed: true, // We'll do a full validation if needed
      };

      next();
    } catch (error) {
      console.error("Plugin license middleware error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to verify plugin license",
      });
    }
  };
};

/**
 * Middleware to check if user has license for any plugin of a specific product
 */
export const requireProductLicense = (productSlug?: string) => {
  return async (
    req: LicenseAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "User authentication required",
        });
        return;
      }

      // Get product slug from parameter, route params, or headers
      const targetProductSlug =
        productSlug ||
        req.params.product_slug ||
        (req.headers["x-product-slug"] as string) ||
        req.body.product_slug ||
        (req.query.product_slug as string);

      if (!targetProductSlug) {
        res.status(400).json({
          success: false,
          error: "Product slug is required",
        });
        return;
      }

      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      // Find product and its plugins
      const product = await prisma.ecosystemProduct.findUnique({
        where: { slug: targetProductSlug },
        include: {
          plugins: {
            where: { is_active: true },
          },
        },
      });

      if (!product) {
        res.status(404).json({
          success: false,
          error: "Product not found",
        });
        return;
      }

      if (!product.is_active) {
        res.status(400).json({
          success: false,
          error: "Product is not available",
        });
        return;
      }

      if (product.plugins.length === 0) {
        res.status(400).json({
          success: false,
          error: "No plugins available for this product",
        });
        return;
      }

      // Check if user has a license for any plugin of this product
      const pluginIds = product.plugins.map((plugin: any) => plugin.id);

      const license = await prisma.license.findFirst({
        where: {
          user_id: req.user.id,
          plugin_id: { in: pluginIds },
          status: "active",
          is_active: true,
        },
        include: {
          plugin: true,
        },
      });

      if (!license) {
        res.status(403).json({
          success: false,
          error: "Valid license required for this product",
          product: {
            id: product.id,
            name: product.name,
            slug: product.slug,
          },
        });
        return;
      }

      // Check if license has expired
      if (license.expires_at && new Date() > license.expires_at) {
        res.status(403).json({
          success: false,
          error: "License has expired",
          license: {
            license_key: license.license_key,
            expires_at: license.expires_at.toISOString(),
          },
        });
        return;
      }

      // Add license info to request
      req.validatedLicense = {
        license_key: license.license_key,
        plugin_id: license.plugin_id,
        user_id: req.user.id,
        download_allowed: true,
      };

      next();
    } catch (error) {
      console.error("Product license middleware error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to verify product license",
      });
    }
  };
};
