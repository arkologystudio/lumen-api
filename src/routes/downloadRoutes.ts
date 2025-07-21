/**
 * Download Routes
 * Routes for protected plugin downloads
 */

import { Router } from "express";
import { authenticateUser } from "../middleware/auth";
import { apiKeyAuth } from "../middleware/auth";
import {
  initiateDownload,
  downloadWithToken,
  getDownloadHistory,
  getDownloadStatus,
  cleanupExpiredDownloads,
} from "../controllers/downloadController";

const router = Router();

// User download endpoints (require authentication)
router.post("/initiate", authenticateUser, initiateDownload);
router.get("/history", authenticateUser, getDownloadHistory);
router.get("/:downloadId/status", authenticateUser, getDownloadStatus);

// Public download endpoint (token-based authentication)
router.get("/file/:token", downloadWithToken);

// Admin endpoints (require API key)
router.delete("/cleanup-expired", apiKeyAuth, cleanupExpiredDownloads);

export default router;
