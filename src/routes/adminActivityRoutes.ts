/**
 * Admin Activity Routes
 * Admin-only routes for system-wide activity management
 */

import { Router } from "express";
import {
  getSystemActivitiesController,
  getSystemActivityStatsController,
} from "../controllers/activityController";
import { apiKeyAuth } from "../middleware/auth";

const router = Router();

// Admin activity routes (API key required)
router.get("/activities", apiKeyAuth, getSystemActivitiesController);
router.get("/activities/stats", apiKeyAuth, getSystemActivityStatsController);

export default router;
