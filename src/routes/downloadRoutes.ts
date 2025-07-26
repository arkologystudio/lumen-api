/**
 * Download Routes
 * Routes for protected plugin downloads
 */

import { Router } from "express";
import { authenticateUser, adminKeyAuth } from "../middleware/auth";
import {
  initiateDownload,
  downloadWithToken,
  getDownloadHistory,
  getDownloadStatus,
  cleanupExpiredDownloads,
} from "../controllers/downloadController";

const router = Router();

// User download endpoints (require authentication) - following documented API patterns
router.post("/initiate", authenticateUser, initiateDownload);
router.get("/user/history", authenticateUser, getDownloadHistory);
router.get("/:downloadId/status", authenticateUser, getDownloadStatus);

// Public download endpoint (token-based authentication) - following documented API patterns
router.get("/file/:download_token", downloadWithToken);

// Admin endpoints (require admin API key)
router.delete("/cleanup-expired", adminKeyAuth, cleanupExpiredDownloads);

export default router;
