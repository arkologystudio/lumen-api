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
} from "../controllers/licenseController";

const router = Router();

// Public license validation
router.post("/validate", validateLicenseHandler);

// User license endpoints (require authentication) - following documented API patterns
router.get("/user", authenticateUser, getMyLicensesController);
router.get("/user/stats", authenticateUser, getMyLicenseStatsController);
router.get("/user/:license_id", authenticateUser, getLicenseController);

// Admin license endpoints (require admin API key) - following documented API patterns
router.post("/admin", adminKeyAuth, createLicenseHandler);
router.put("/admin/:license_id", adminKeyAuth, updateLicenseController);
router.delete("/admin/:license_id", adminKeyAuth, revokeLicenseController);

// Legacy admin endpoints (for backwards compatibility)
router.get("/user/:userId", adminKeyAuth, getUserLicensesController);
router.get("/plugin/:pluginId", adminKeyAuth, getPluginLicensesController);

export default router;
