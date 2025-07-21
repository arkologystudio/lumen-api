/**
 * Pricing Routes
 * Handles all pricing and billing related endpoints
 */

import express from "express";
import {
  getPricingTiers,
  getPricingTier,
  calculatePricing,
  getProductPricingTiers,
  getPricingComparison,
} from "../controllers/pricingController";

const router = express.Router();

/**
 * Public pricing endpoints - no authentication required
 * These are for displaying pricing information to potential customers
 */

// GET /api/pricing/tiers - Get all available pricing tiers
router.get("/tiers", getPricingTiers);

// GET /api/pricing/tiers/:tier_name - Get specific pricing tier details
router.get("/tiers/:tier_name", getPricingTier);

// POST /api/pricing/calculate - Calculate pricing for a configuration
router.post("/calculate", calculatePricing);

// GET /api/pricing/products/:product_slug/tiers - Get pricing tiers for a product
router.get("/products/:product_slug/tiers", getProductPricingTiers);

// GET /api/pricing/comparison - Get pricing tier comparison data
router.get("/comparison", getPricingComparison);

export default router;
