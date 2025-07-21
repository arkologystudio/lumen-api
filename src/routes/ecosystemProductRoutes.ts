/**
 * Ecosystem Product Routes
 * API routes for managing ecosystem products and site registrations
 */

import { Router } from "express";
import { authenticateJWT } from "../middleware/auth";
import {
  getEcosystemProductsController,
  getEcosystemProductController,
  getSiteProductsController,
  registerSiteProductController,
  updateSiteProductController,
  unregisterSiteProductController,
  checkSiteProductController,
  trackProductUsageController,
  getProductCategoriesController,
} from "../controllers/ecosystemProductController";

const router = Router();

// All routes require authentication
router.use(authenticateJWT);

// User routes - browsing available ecosystem products (logged-in users)
router.get("/products", getEcosystemProductsController);
router.get("/products/:slug", getEcosystemProductController);
router.get("/categories", getProductCategoriesController);

// Site product management
router.get("/sites/:siteId/products", getSiteProductsController);
router.post("/sites/:siteId/products", registerSiteProductController);
router.put("/sites/:siteId/products/:productSlug", updateSiteProductController);
router.delete(
  "/sites/:siteId/products/:productSlug",
  unregisterSiteProductController
);

// Site product status and usage
router.get(
  "/sites/:siteId/products/:productSlug/status",
  checkSiteProductController
);
router.post(
  "/sites/:siteId/products/:productSlug/track-usage",
  trackProductUsageController
);

export default router;
