/**
 * Product routes for handling product embedding and search operations
 */

import { Router } from "express";
import { authenticateJWT } from "../middleware/auth";
import {
  embedProduct,
  embedProductBatch,
  searchProducts,
  getProductSuggestions,
  validateProductData,
} from "../controllers/productController";

const router = Router();

// All product routes require authentication
router.use(authenticateJWT);

/**
 * POST /api/products/embed
 * Embed a single product
 */
router.post("/embed", embedProduct);

/**
 * POST /api/products/embed/batch
 * Embed multiple products in batch
 */
router.post("/embed/batch", embedProductBatch);

/**
 * POST /api/products/search
 * Search products with optional filters
 */
router.post("/search", searchProducts);

/**
 * GET /api/products/suggestions
 * Get search suggestions based on product attributes
 * Query params: site_id, category?, brand?, price_range?
 */
router.get("/suggestions", getProductSuggestions);

/**
 * POST /api/products/validate
 * Validate product data structure before embedding
 */
router.post("/validate", validateProductData);

export default router;
