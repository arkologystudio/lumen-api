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
import { authenticateUser } from "../middleware/auth";
import { searchRateLimiter } from "../middleware/rateLimit";

const router = express.Router();

// ── ALL ROUTES REQUIRE USER AUTHENTICATION ───────────────────────────────
router.use(authenticateUser);

// ── SITE MANAGEMENT ───────────────────────────────────────────────────────
router.post("/", createSiteController);
router.get("/:site_id", getSiteController);
router.put("/:site_id", updateSiteController);
router.delete("/:site_id", deleteSiteController);

// ── SITE STATISTICS ───────────────────────────────────────────────────────
router.get("/:site_id/stats", getSiteStatsController);

// ── SITE ACTIONS ──────────────────────────────────────────────────────────
router.post("/:site_id/search", searchRateLimiter, searchSiteController);
router.post("/:site_id/embed", embedSiteController);

export default router;
