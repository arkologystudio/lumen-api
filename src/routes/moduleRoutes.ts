import express, { Router } from "express";
import {
  getAllModules,
  getModulesCount,
  getModuleById,
} from "../controllers/moduleController";
import { apiKeyAuth } from "../middleware/auth";

const router: Router = express.Router();

// ── ALL MODULE ROUTES REQUIRE API KEY ──────────────────────────────────────────
router.use(apiKeyAuth);

router.get("/", getAllModules);
router.get("/count/total", getModulesCount);
router.get("/:id", getModuleById);

export default router;
