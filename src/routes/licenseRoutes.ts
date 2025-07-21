/**
 * License Routes
 * Routes for license management operations
 */

import { Router } from "express";
import { authenticateUser, apiKeyAuth } from "../middleware/auth";
import {
  createLicenseController,
  validateLicenseController,
  getLicenseController,
  getUserLicensesController,
  getMyLicensesController,
  getPluginLicensesController,
  updateLicenseController,
  revokeLicenseController,
  getUserLicenseStatsController,
  getMyLicenseStatsController,
  cleanupExpiredLicensesController,
  getLicenseByKeyController,
} from "../controllers/licenseController";

const router = Router();

// Public license validation
router.post("/validate", validateLicenseController);

// User license endpoints (require authentication)
router.get("/my", authenticateUser, getMyLicensesController);
router.get("/stats/my", authenticateUser, getMyLicenseStatsController);
router.get(
  "/key/:licenseKey/info",
  authenticateUser,
  getLicenseByKeyController
);
router.get("/:licenseId", authenticateUser, getLicenseController);

// Admin license endpoints (require API key)
router.post("/", apiKeyAuth, createLicenseController);
router.get("/user/:userId", apiKeyAuth, getUserLicensesController);
router.get("/plugin/:pluginId", apiKeyAuth, getPluginLicensesController);
router.get("/stats/user/:userId", apiKeyAuth, getUserLicenseStatsController);
router.put("/:licenseId", apiKeyAuth, updateLicenseController);
router.delete("/:licenseId/revoke", apiKeyAuth, revokeLicenseController);
router.post("/cleanup-expired", apiKeyAuth, cleanupExpiredLicensesController);

export default router;
