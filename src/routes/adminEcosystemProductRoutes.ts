/**
 * Admin Ecosystem Product Routes
 * API routes for admin CRUD operations on ecosystem products
 */

import { Router } from "express";
import { apiKeyAuth } from "../middleware/auth";
import {
  createEcosystemProductController,
  updateEcosystemProductController,
  deleteEcosystemProductController,
  getAdminEcosystemProductsController,
} from "../controllers/ecosystemProductController";

const router = Router();

// All admin routes require API key authentication
router.use(apiKeyAuth);

// Admin CRUD operations for ecosystem products
router.get("/ecosystem/products", getAdminEcosystemProductsController);
router.post("/ecosystem/products", createEcosystemProductController);
router.put("/ecosystem/products/:slug", updateEcosystemProductController);
router.delete("/ecosystem/products/:slug", deleteEcosystemProductController);

export default router;
