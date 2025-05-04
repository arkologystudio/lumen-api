import express from "express";
import {
  embedCurriculumContent,
  searchCurriculumModules,
  embedTest,
  getEmbeddingsCount,
  dropCollection,
} from "../controllers/embeddingController";
import { apiKeyAuth, authenticateJWT } from "../middleware/auth";
import { searchRateLimiter } from "../middleware/rateLimit";

const router = express.Router();

// ── JWT‐PROTECTED (public client) ──────────────────────────────────────────────
router.post(
  "/search",
  authenticateJWT,
  searchRateLimiter,
  searchCurriculumModules
);

// ── API‐KEY‐PROTECTED (server‐to‐server) ────────────────────────────────────────
router.post("/embed-curriculum", apiKeyAuth, embedCurriculumContent);
router.post("/embed-test", apiKeyAuth, embedTest);
router.post("/drop-collection", apiKeyAuth, dropCollection);
router.get("/count", apiKeyAuth, getEmbeddingsCount);

export default router;
