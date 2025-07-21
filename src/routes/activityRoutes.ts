/**
 * Activity Routes
 * Routes for activity logging and Recent Activity feed
 */

import { Router } from "express";
import {
  getUserActivitiesController,
  getSiteActivitiesController,
  getSystemActivitiesController,
  getUserActivityStatsController,
  getSiteActivityStatsController,
  getSystemActivityStatsController,
} from "../controllers/activityController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

// User activity routes (JWT required)
router.get("/activities", authenticateJWT, getUserActivitiesController);
router.get(
  "/activities/stats",
  authenticateJWT,
  getUserActivityStatsController
);

// Site activity routes (JWT required)
router.get(
  "/sites/:siteId/activities",
  authenticateJWT,
  getSiteActivitiesController
);
router.get(
  "/sites/:siteId/activities/stats",
  authenticateJWT,
  getSiteActivityStatsController
);

export default router;
