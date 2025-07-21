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
} from "../controllers/licenseController";

const router = Router();

// Public license validation
router.post("/validate", validateLicenseHandler);

// User license endpoints (require authentication)
router.get("/me", authenticateUser, getMyLicensesController);
router.get("/:id", authenticateUser, getLicenseController);
router.put("/:id", authenticateUser, updateLicenseController);

// Admin license endpoints (require admin API key)
router.post("/", adminKeyAuth, createLicenseHandler);
router.get("/user/:userId", adminKeyAuth, getUserLicensesController);
router.get("/plugin/:pluginId", adminKeyAuth, getPluginLicensesController);
router.delete("/:id", adminKeyAuth, revokeLicenseController);

export default router;
