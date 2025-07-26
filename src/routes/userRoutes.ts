import express from "express";
import {
  registerUser,
  loginUserController,
  getUserProfile,
  updateUserProfile,
  getUserSites,
} from "../controllers/userController";
import {
  getUserActivitiesController,
  getUserActivityStatsController,
} from "../controllers/activityController";
import { authenticateUser } from "../middleware/auth";

const router = express.Router();

// ── PUBLIC ROUTES ──────────────────────────────────────────────────────────
router.post("/register", registerUser);
router.post("/login", loginUserController);

// ── PROTECTED ROUTES (User Authentication Required) ───────────────────────
router.get("/profile", authenticateUser, getUserProfile);
router.put("/profile", authenticateUser, updateUserProfile);
router.get("/sites", authenticateUser, getUserSites);

// ── USER ACTIVITY ROUTES (User Authentication Required) ───────────────────
router.get("/activities", authenticateUser, getUserActivitiesController);
router.get("/activities/stats", authenticateUser, getUserActivityStatsController);

export default router;
