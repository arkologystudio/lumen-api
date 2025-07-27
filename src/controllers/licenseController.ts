/**
 * License Controller
 * Handles license management operations
 */

import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  validateLicense,
  getLicenseById,
  getProductLicenses,
  createLicense,
  updateLicense,
  revokeLicense,
  getUserLicenses,
  getUserLicenseStats,
  updateExpiredLicenses,
} from "../services/licenseService";
import { logActivity } from "../services/activityLogService";
import {
  CreateLicenseRequest,
  UpdateLicenseRequest,
  ValidateLicenseRequest,
} from "../types";

/**
 * POST /api/licenses
 * Create a new license for a user and product
 */
export const createLicenseHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const licenseRequest: CreateLicenseRequest = req.body;

    if (!licenseRequest.user_id || !licenseRequest.product_slug) {
      res.status(400).json({
        success: false,
        error: "User ID and product slug are required",
      });
      return;
    }

    const license = await createLicense(licenseRequest);

    // Log activity
    if (license.product) {
      await logActivity({
        user_id: license.user_id,
        activity_type: "license_created",
        title: `License created for product: ${license.product?.name}`,
        description: `License ${license.license_key} created for product ${license.product?.name}`,
        metadata: {
          product_id: license.product_id,
          product_name: license.product?.name,
          license_type: license.license_type,
        },
      });
    }

    res.status(201).json({
      success: true,
      license,
      message: "License created successfully",
    });
  } catch (error: any) {
    console.error("Error creating license:", error);

    if (error.message?.includes("already exists")) {
      res.status(409).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to create license",
      });
    }
  }
};

/**
 * POST /api/licenses/validate
 * Validate a license key for a product
 */
export const validateLicenseHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { license_key, product_slug }: ValidateLicenseRequest = req.body;

    if (!license_key || !product_slug) {
      res.status(400).json({
        success: false,
        error: "license_key and product_slug are required",
      });
      return;
    }

    const license = await validateLicense(license_key, product_slug);

    if (!license) {
      res.json({
        success: true,
        valid: false,
        reason: "License not found or invalid",
      });
      return;
    }

    res.json({
      success: true,
      valid: true,
      license,
    });
  } catch (error) {
    console.error("Error validating license:", error);
    res.status(500).json({
      success: false,
      error: "Failed to validate license",
    });
  }
};

/**
 * GET /api/licenses/:licenseId
 * Get license by ID
 */
export const getLicenseController = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { licenseId } = req.params;

    const license = await getLicenseById(licenseId);
    if (!license) {
      res.status(404).json({
        success: false,
        error: "License not found",
      });
      return;
    }

    // Check if user owns the license
    if (license.user_id !== req.user.id) {
      res.status(403).json({
        success: false,
        error: "Access denied",
      });
      return;
    }

    res.json({
      success: true,
      license,
    });
  } catch (error) {
    console.error("Error getting license:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get license",
    });
  }
};

/**
 * GET /api/licenses/user/:userId
 * Get all licenses for a user (admin only)
 */
export const getUserLicensesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { include_inactive = "false" } = req.query;

    const includeInactive = include_inactive === "true";
    const licenses = await getUserLicenses(userId, includeInactive ? {} : { status: "active" });

    res.json({
      success: true,
      licenses,
      total: licenses.length,
    });
  } catch (error) {
    console.error("Error getting user licenses:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get user licenses",
    });
  }
};

/**
 * GET /api/licenses/my
 * Get current user's licenses
 */
export const getMyLicensesController = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { include_inactive = "false" } = req.query;
    const includeInactive = include_inactive === "true";

    const licenses = await getUserLicenses(req.user.id, includeInactive ? {} : { status: "active" });

    res.json({
      success: true,
      licenses,
      total: licenses.length,
    });
  } catch (error) {
    console.error("Error getting user licenses:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get licenses",
    });
  }
};

/**
 * GET /api/licenses/plugin/:pluginId
 * Get all licenses for a plugin (admin only)
 */
export const getPluginLicensesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { pluginId } = req.params;

    const licenses = await getProductLicenses(pluginId);

    res.json({
      success: true,
      licenses,
      total: licenses.length,
    });
  } catch (error) {
    console.error("Error getting plugin licenses:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get plugin licenses",
    });
  }
};

/**
 * PUT /api/licenses/:licenseId
 * Update a license (admin only)
 */
export const updateLicenseController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { licenseId } = req.params;
    const updates: UpdateLicenseRequest = req.body;

    const license = await updateLicense(licenseId, updates);

    res.json({
      success: true,
      license,
      message: "License updated successfully",
    });
  } catch (error) {
    console.error("Error updating license:", error);
    res.status(400).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update license",
    });
  }
};

/**
 * DELETE /api/licenses/:licenseId/revoke
 * Revoke a license (admin only)
 */
export const revokeLicenseController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { licenseId } = req.params;

    const license = await revokeLicense(licenseId);

    res.json({
      success: true,
      license,
      message: "License revoked successfully",
    });
  } catch (error) {
    console.error("Error revoking license:", error);
    res.status(400).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to revoke license",
    });
  }
};

/**
 * GET /api/licenses/stats/user/:userId
 * Get license statistics for a user (admin only)
 */
export const getUserLicenseStatsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    const stats = await getUserLicenseStats(userId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error getting user license stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get license statistics",
    });
  }
};

/**
 * GET /api/licenses/stats/my
 * Get current user's license statistics
 */
export const getMyLicenseStatsController = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const stats = await getUserLicenseStats(req.user.id);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error getting license stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get license statistics",
    });
  }
};

/**
 * POST /api/licenses/cleanup-expired
 * Update expired licenses (admin only - should be run as a background job)
 */
export const cleanupExpiredLicensesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const updatedCount = await updateExpiredLicenses();

    res.json({
      success: true,
      message: `Updated ${updatedCount} expired licenses`,
      count: updatedCount,
    });
  } catch (error) {
    console.error("Error cleaning up expired licenses:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cleanup expired licenses",
    });
  }
};

/**
 * GET /api/licenses/key/:licenseKey/info
 * Get license information by key (for license holder verification)
 */
export const getLicenseByKeyController = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { licenseKey } = req.params;
    const { product_slug } = req.query;

    if (!product_slug || typeof product_slug !== 'string') {
      res.status(400).json({
        success: false,
        error: "product_slug query parameter is required",
      });
      return;
    }

    const license = await validateLicense(licenseKey, product_slug);

    if (!license) {
      res.status(404).json({
        success: false,
        error: "License not found or invalid",
      });
      return;
    }

    // Check if user owns the license
    if (license.user_id !== req.user.id) {
      res.status(403).json({
        success: false,
        error: "Access denied",
      });
      return;
    }

    // Check download allowance based on license limits
    const downloadAllowed = !license.max_downloads || license.download_count < license.max_downloads;

    res.json({
      success: true,
      license,
      download_allowed: downloadAllowed,
    });
  } catch (error) {
    console.error("Error getting license by key:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get license information",
    });
  }
};

/**
 * GET /api/licenses/:licenseId/usage
 * Get license usage details
 */
export const getLicenseUsageController = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { licenseId } = req.params;

    const license = await getLicenseById(licenseId);
    if (!license) {
      res.status(404).json({
        success: false,
        error: "License not found",
      });
      return;
    }

    // Check if user owns the license
    if (license.user_id !== req.user.id) {
      res.status(403).json({
        success: false,
        error: "Access denied",
      });
      return;
    }

    const usage = {
      queries_used: license.query_count,
      queries_remaining: license.max_queries ? Math.max(0, license.max_queries - license.query_count) : null,
      query_period_start: license.query_period_start,
      query_period_end: license.query_period_end,
      downloads_used: license.download_count,
      downloads_remaining: license.max_downloads ? Math.max(0, license.max_downloads - license.download_count) : null,
      sites_used: license.additional_sites + 1, // Base site + additional
      sites_remaining: Math.max(0, license.max_sites - (license.additional_sites + 1)),
      agent_access_enabled: license.agent_api_access,
      custom_embedding_enabled: license.custom_embedding,
    };

    res.json({
      success: true,
      usage,
    });
  } catch (error) {
    console.error("Error getting license usage:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get license usage",
    });
  }
};

/**
 * POST /api/licenses/admin/:licenseId/reset-usage
 * Reset query usage for a license (admin only)
 */
export const resetLicenseUsageController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { licenseId } = req.params;

    const license = await getLicenseById(licenseId);
    if (!license) {
      res.status(404).json({
        success: false,
        error: "License not found",
      });
      return;
    }

    // Reset query usage and period
    const now = new Date();
    const updatedLicense = await updateLicense(licenseId, {
      query_count: 0,
      query_period_start: now,
      query_period_end: calculateNextPeriodEnd(now, license.billing_period),
    });

    res.json({
      success: true,
      license: updatedLicense,
      message: "License usage reset successfully",
    });
  } catch (error) {
    console.error("Error resetting license usage:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reset license usage",
    });
  }
};

/**
 * Calculate the next billing period end date
 */
function calculateNextPeriodEnd(start: Date, billingPeriod: string): Date {
  const end = new Date(start);
  
  switch (billingPeriod) {
    case "monthly":
      end.setMonth(end.getMonth() + 1);
      break;
    case "annual":
      end.setFullYear(end.getFullYear() + 1);
      break;
    default:
      // Default to monthly
      end.setMonth(end.getMonth() + 1);
      break;
  }
  
  return end;
}
