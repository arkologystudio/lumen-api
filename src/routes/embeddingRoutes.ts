import express from "express";
import {
  searchPosts,
  embedTest,
  getSiteChunksCountController,
  dropSiteCollectionController,
  listSiteCollectionsController,
  getSiteStatsController,
  getEmbeddingStatusController,
} from "../controllers/embeddingController";
import { apiKeyAuth, authenticateJWT } from "../middleware/auth";
import { searchRateLimiter } from "../middleware/rateLimit";

const router = express.Router();

// ── JWT‐PROTECTED (public client) ──────────────────────────────────────────────
router.post("/search", authenticateJWT, searchRateLimiter, searchPosts);

// ── API‐KEY‐PROTECTED (server‐to‐server) ────────────────────────────────────────

// Site management endpoints
router.get("/sites", apiKeyAuth, listSiteCollectionsController);
router.get("/sites/:site_id/stats", apiKeyAuth, getSiteStatsController);
router.get("/sites/:site_id/status", apiKeyAuth, getEmbeddingStatusController);
router.get("/sites/:site_id/count", apiKeyAuth, getSiteChunksCountController);
router.delete(
  "/sites/:site_id/collection",
  apiKeyAuth,
  dropSiteCollectionController
);

// Embedding endpoints
router.post("/embed-test", apiKeyAuth, embedTest);

export default router;
