/**
 * License Routes
 * Routes for license management operations
 */

import { Router } from "express";
import { authenticateUser, adminKeyAuth } from "../middleware/auth";
import {
  getLicenseController,
  createLicenseHandler,
  validateLicenseHandler,
  updateLicenseController,
  revokeLicenseController,
  getUserLicensesController,
  getMyLicensesController,
  getPluginLicensesController,
  getMyLicenseStatsController,
  getLicenseUsageController,
  resetLicenseUsageController,
} from "../controllers/licenseController";

const router = Router();

// Public license validation
router.post("/validate", validateLicenseHandler);

// User license endpoints (require authentication) - following documented API patterns
router.get("/my", authenticateUser, getMyLicensesController);
router.get("/my/stats", authenticateUser, getMyLicenseStatsController);
router.get("/:license_id", authenticateUser, getLicenseController);
router.get("/:license_id/usage", authenticateUser, getLicenseUsageController);

// Admin license endpoints (require admin API key) - following documented API patterns
router.post("/admin", adminKeyAuth, createLicenseHandler);
router.put("/admin/:license_id", adminKeyAuth, updateLicenseController);
router.delete("/admin/:license_id/revoke", adminKeyAuth, revokeLicenseController);
router.post("/admin/:license_id/reset-usage", adminKeyAuth, resetLicenseUsageController);

// Legacy admin endpoints (for backwards compatibility)
router.get("/user/:userId", adminKeyAuth, getUserLicensesController);
router.get("/plugin/:pluginId", adminKeyAuth, getPluginLicensesController);

export default router;
