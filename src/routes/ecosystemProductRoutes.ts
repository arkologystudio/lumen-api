/**
 * Product Routes
 * API routes for managing products and site registrations (unified from ecosystem products and plugins)
 */

import { Router } from "express";
import {
  getAllProductsController,
  getProductBySlugController,
  getProductCategoriesController,
} from "../controllers/ecosystemProductController";

const router = Router();

// Public product endpoints
router.get("/products", getAllProductsController);
router.get("/products/:slug", getProductBySlugController);
router.get("/categories", getProductCategoriesController);

export default router;
