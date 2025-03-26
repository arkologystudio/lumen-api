import express from "express";
import {
  embedCurriculumContent,
  searchCurriculumModules,
  embedTest,
  getEmbeddingsCount,
  dropCollection,
} from "../controllers/embeddingController";

const router = express.Router();

// Endpoint to embed all curriculum content
router.post("/embed-curriculum", embedCurriculumContent);

// Endpoint to search curriculum modules
router.post("/search", searchCurriculumModules);

// Endpoint to get embeddings count
router.get("/count", getEmbeddingsCount);

router.post("/embed-test", embedTest);

router.post("/drop-collection", dropCollection);

export default router;
