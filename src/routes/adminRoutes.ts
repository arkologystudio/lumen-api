import express from "express";
import {
  getAllUsersController,
  getAllSitesController,
  getAllCollectionsController,
  getSystemStatsController,
  initializeProductsController,
  initializePricingTiersController,
  initializeCompleteSystemController,
  cleanupEcosystemProductsController,
  getProductsStatusController,
  getAdminEcosystemProductsController,
  createAdminEcosystemProductController,
  updateAdminEcosystemProductController,
  deleteAdminEcosystemProductController,
} from "../controllers/adminController";
import {
  dropSiteCollectionController,
  getSiteChunksCountController,
  getEmbeddingStatusController,
} from "../controllers/embeddingController";
import { adminKeyAuth } from "../middleware/auth";

const router = express.Router();

// ── ALL ADMIN ROUTES REQUIRE ADMIN API KEY AUTHENTICATION ──────────────────────
router.use(adminKeyAuth);

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

// ── ECOSYSTEM PRODUCTS & LICENSING ─────────────────────────────────────────
router.get("/products/status", getProductsStatusController);
router.post("/products/initialize", initializeProductsController);
router.post("/pricing-tiers/initialize", initializePricingTiersController);
router.post("/system/initialize", initializeCompleteSystemController);
router.post("/products/cleanup", cleanupEcosystemProductsController);

// ── ECOSYSTEM PRODUCT MANAGEMENT ───────────────────────────────────────────
router.get("/ecosystem/products", getAdminEcosystemProductsController);
router.post("/ecosystem/products", createAdminEcosystemProductController);
router.put("/ecosystem/products/:slug", updateAdminEcosystemProductController);
router.delete("/ecosystem/products/:slug", deleteAdminEcosystemProductController);

export default router;
