/**
 * Admin Activity Routes
 * Admin-only routes for system-wide activity management
 */

import { Router } from "express";
import {
  getSystemActivitiesController,
  getSystemActivityStatsController,
} from "../controllers/activityController";
import { adminKeyAuth } from "../middleware/auth";

const router = Router();

// Admin activity routes (Admin API key required)
router.get("/activities", adminKeyAuth, getSystemActivitiesController);
router.get("/activities/stats", adminKeyAuth, getSystemActivityStatsController);

export default router;
