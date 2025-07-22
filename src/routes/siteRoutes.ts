import express from "express";
import {
  createSiteController,
  getSiteController,
  updateSiteController,
  deleteSiteController,
  getSiteStatsController,
  searchSiteController,
  embedSiteController,
} from "../controllers/siteController";
import { authenticateUser, scopedApiKeyAuth } from "../middleware/auth";
import { searchRateLimiter } from "../middleware/rateLimit";

const router = express.Router();

// ── SITE MANAGEMENT ROUTES (require user authentication) ──────────────────
router.post("/", authenticateUser, createSiteController);
router.get("/:site_id", authenticateUser, getSiteController);
router.put("/:site_id", authenticateUser, updateSiteController);
router.delete("/:site_id", authenticateUser, deleteSiteController);
router.get("/:site_id/stats", authenticateUser, getSiteStatsController);

// ── PLUGIN ROUTES (require scoped API key authentication) ──────────────────
// Search endpoint for WordPress plugin visitors
router.post("/:site_id/search", 
  scopedApiKeyAuth(['search']), 
  searchRateLimiter, 
  searchSiteController
);

// Embed endpoint for WordPress plugin content ingestion
router.post("/:site_id/embed", 
  scopedApiKeyAuth(['embed']), 
  embedSiteController
);

export default router;
