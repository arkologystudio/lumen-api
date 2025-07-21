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
import { scopedApiKeyAuth, authenticateJWT } from "../middleware/auth";
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
router.get("/sites", scopedApiKeyAuth(['embed']), listSiteCollectionsController);
router.get("/sites/:site_id/stats", scopedApiKeyAuth(['embed']), getSiteStatsController);
router.get("/sites/:site_id/status", scopedApiKeyAuth(['embed']), getEmbeddingStatusController);
router.get("/sites/:site_id/count", scopedApiKeyAuth(['embed']), getSiteChunksCountController);
router.delete(
  "/sites/:site_id/collection",
  scopedApiKeyAuth(['embed']),
  dropSiteCollectionController
);

// Legacy embedding endpoint (now also available in /api/sites/:site_id/embed)
router.post("/embed-test", scopedApiKeyAuth(['embed']), embedTest);

export default router;
