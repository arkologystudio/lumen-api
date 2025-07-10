import express from "express";
import {
  getAllUsersController,
  getAllSitesController,
  getAllCollectionsController,
  getSystemStatsController,
} from "../controllers/adminController";
import {
  dropSiteCollectionController,
  getSiteChunksCountController,
  getEmbeddingStatusController,
} from "../controllers/embeddingController";
import { apiKeyAuth } from "../middleware/auth";

const router = express.Router();

// ── ALL ADMIN ROUTES REQUIRE API KEY AUTHENTICATION ──────────────────────
router.use(apiKeyAuth);

// ── USER MANAGEMENT ───────────────────────────────────────────────────────
router.get("/users", getAllUsersController);

// ── SITE MANAGEMENT ───────────────────────────────────────────────────────
router.get("/sites", getAllSitesController);
router.get("/sites/:site_id/chunks/count", getSiteChunksCountController);
router.get("/sites/:site_id/embedding/status", getEmbeddingStatusController);
router.delete("/sites/:site_id/collection", dropSiteCollectionController);

// ── VECTOR COLLECTIONS ────────────────────────────────────────────────────
router.get("/collections", getAllCollectionsController);

// ── SYSTEM STATISTICS ─────────────────────────────────────────────────────
router.get("/stats", getSystemStatsController);

export default router;
