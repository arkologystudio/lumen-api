import express from "express";
import {
  searchPosts,
  embedTest,
  getSiteChunksCountController,
  dropSiteCollectionController,
  listSiteCollectionsController,
  getSiteStatsController,
  getEmbeddingStatusController,
  unifiedSearchController,
} from "../controllers/embeddingController";
import { apiKeyAuth, authenticateJWT } from "../middleware/auth";
import { searchRateLimiter } from "../middleware/rateLimit";

const router = express.Router();

// ── JWT‐PROTECTED (public client - legacy endpoint) ───────────────────────────
router.post("/search", authenticateJWT, searchRateLimiter, searchPosts);

// ── UNIFIED SEARCH (posts + products) ──────────────────────────────────────────
router.post(
  "/unified-search",
  authenticateJWT,
  searchRateLimiter,
  unifiedSearchController
);

// ── API‐KEY‐PROTECTED (server‐to‐server) ────────────────────────────────────────

// Legacy site management endpoints (now also available in /api/admin)
router.get("/sites", apiKeyAuth, listSiteCollectionsController);
router.get("/sites/:site_id/stats", apiKeyAuth, getSiteStatsController);
router.get("/sites/:site_id/status", apiKeyAuth, getEmbeddingStatusController);
router.get("/sites/:site_id/count", apiKeyAuth, getSiteChunksCountController);
router.delete(
  "/sites/:site_id/collection",
  apiKeyAuth,
  dropSiteCollectionController
);

// Legacy embedding endpoint (now also available in /api/sites/:site_id/embed)
router.post("/embed-test", apiKeyAuth, embedTest);

export default router;
