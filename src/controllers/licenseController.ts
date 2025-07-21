/**
 * License Controller
 * Handles license management operations
 */

import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  createLicense,
  validateLicense,
  getLicenseById,
  getUserLicenses,
  getPluginLicenses,
  updateLicense,
  revokeLicense,
  getUserLicenseStats,
  updateExpiredLicenses,
} from "../services/licenseService";
import {
  CreateLicenseRequest,
  UpdateLicenseRequest,
  ValidateLicenseRequest,
} from "../types";
import {
  logActivityWithRequest,
  ACTIVITY_TYPES,
} from "../services/activityLogService";

/**
 * POST /api/licenses
 * Create a new license (admin only)
 */
export const createLicenseController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const licenseRequest: CreateLicenseRequest = req.body;

    if (!licenseRequest.user_id || !licenseRequest.plugin_id) {
      res.status(400).json({
        success: false,
        error: "User ID and Plugin ID are required",
      });
      return;
    }

    const license = await createLicense(licenseRequest);

    // Log license creation activity
    try {
      await logActivityWithRequest(
        req,
        licenseRequest.user_id,
        ACTIVITY_TYPES.PRODUCT_REGISTERED,
        `License created for plugin: ${license.plugin?.name}`,
        {
          description: `License ${license.license_key} created for plugin ${license.plugin?.name}`,
          metadata: {
            license_id: license.id,
            license_key: license.license_key,
            license_type: license.license_type,
            plugin_id: license.plugin_id,
            plugin_name: license.plugin?.name,
          },
        }
      );
    } catch (activityError) {
      console.error("Failed to log license creation activity:", activityError);
    }

    res.status(201).json({
      success: true,
      license,
      message: "License created successfully",
    });
  } catch (error) {
    console.error("Error creating license:", error);
    res.status(400).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create license",
    });
  }
};

/**
 * POST /api/licenses/validate
 * Validate a license key
 */
export const validateLicenseController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { license_key, plugin_id }: ValidateLicenseRequest = req.body;

    if (!license_key) {
      res.status(400).json({
        success: false,
        error: "License key is required",
      });
      return;
    }

    const validation = await validateLicense({ license_key, plugin_id });

    res.json({
      success: true,
      validation,
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
    const licenses = await getUserLicenses(userId, includeInactive);

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

    const licenses = await getUserLicenses(req.user.id, includeInactive);

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
    const { status } = req.query;

    const licenses = await getPluginLicenses(pluginId, status as any);

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

    const validation = await validateLicense({ license_key: licenseKey });

    if (!validation.valid || !validation.license) {
      res.status(404).json({
        success: false,
        error: validation.message || "License not found",
      });
      return;
    }

    // Check if user owns the license
    if (validation.license.user_id !== req.user.id) {
      res.status(403).json({
        success: false,
        error: "Access denied",
      });
      return;
    }

    res.json({
      success: true,
      license: validation.license,
      download_allowed: validation.download_allowed,
    });
  } catch (error) {
    console.error("Error getting license by key:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get license information",
    });
  }
};
