/**
 * Purchase Routes
 * Routes for simulated plugin purchases
 */

import { Router } from "express";
import { authenticateUser, adminKeyAuth } from "../middleware/auth";
import {
  simulatePurchase,
  getAvailableProducts,
  getPurchaseHistory,
  giftLicense,
} from "../controllers/purchaseController";

const router = Router();

// User purchase endpoints (require authentication) - following documented API patterns
router.post("/simulate", authenticateUser, simulatePurchase);
router.get("/available", authenticateUser, getAvailableProducts);
router.get("/user/history", authenticateUser, getPurchaseHistory);

// Admin endpoints (require admin API key) - following documented API patterns
router.post("/admin/gift", adminKeyAuth, giftLicense);

export default router;
