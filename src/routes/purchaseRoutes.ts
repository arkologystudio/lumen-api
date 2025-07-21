/**
 * Purchase Routes
 * Routes for simulated plugin purchases
 */

import { Router } from "express";
import { authenticateUser, apiKeyAuth } from "../middleware/auth";
import {
  simulatePurchase,
  getAvailableProducts,
  getPurchaseHistory,
  giftLicense,
} from "../controllers/purchaseController";

const router = Router();

// User purchase endpoints (require authentication)
router.post("/simulate", authenticateUser, simulatePurchase);
router.get("/available", authenticateUser, getAvailableProducts);
router.get("/history", authenticateUser, getPurchaseHistory);

// Admin endpoints (require API key)
router.post("/gift", apiKeyAuth, giftLicense);

export default router;
