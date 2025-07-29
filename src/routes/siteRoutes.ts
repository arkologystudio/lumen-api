import express from "express";
import {
  createSiteController,
  getSiteController,
  updateSiteController,
  deleteSiteController,
  getSiteStatsController,
  searchSiteController,
  embedSiteController,
  getSiteProductsController,
  registerSiteProductController,
  updateSiteProductController,
  unregisterSiteProductController,
  getSiteProductStatusController,
  getSiteCredentialsController,
} from "../controllers/siteController";
import {
  getSiteActivitiesController,
  getSiteActivityStatsController,
} from "../controllers/activityController";
import { authenticateUser, scopedApiKeyAuth } from "../middleware/auth";
import { searchRateLimiter } from "../middleware/rateLimit";
import { validateQueryLicense, trackQuery } from "../middleware/queryValidation";

const router = express.Router();

// ── SITE MANAGEMENT ROUTES (require user authentication) ──────────────────
router.post("/", authenticateUser, createSiteController);
router.get("/:site_id", authenticateUser, getSiteController);
router.put("/:site_id", authenticateUser, updateSiteController);
router.delete("/:site_id", authenticateUser, deleteSiteController);
router.get("/:site_id/stats", authenticateUser, getSiteStatsController);
router.get("/:site_id/credentials", authenticateUser, getSiteCredentialsController);

// ── SITE PRODUCT ROUTES (require user authentication) ──────────────────
router.get("/:siteId/products", authenticateUser, getSiteProductsController);
router.post("/:siteId/products", authenticateUser, registerSiteProductController);
router.put("/:siteId/products/:productSlug", authenticateUser, updateSiteProductController);
router.delete("/:siteId/products/:productSlug", authenticateUser, unregisterSiteProductController);
router.get("/:siteId/products/:productSlug/status", authenticateUser, getSiteProductStatusController);

// ── SITE ACTIVITY ROUTES (require user authentication) ─────────────────────
router.get("/:siteId/activities", authenticateUser, getSiteActivitiesController);
router.get("/:siteId/activities/stats", authenticateUser, getSiteActivityStatsController);

// ── PLUGIN ROUTES (require scoped API key authentication + license validation) ──────────────────
// Search endpoint for WordPress plugin visitors with license validation
router.post("/:site_id/search", 
  scopedApiKeyAuth(['search']),
  validateQueryLicense('lumen-search-api'),
  searchRateLimiter,
  trackQuery(),
  searchSiteController
);

// Embed endpoint for WordPress plugin content ingestion
router.post("/:site_id/embed", 
  scopedApiKeyAuth(['embed']), 
  embedSiteController
);

export default router;
