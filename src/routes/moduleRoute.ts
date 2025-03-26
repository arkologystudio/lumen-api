import express, { Router, RequestHandler } from "express";
import { dbService } from "../services/database";

const router: Router = express.Router();

// Get all modules
router.get("/", async (req, res) => {
  try {
    console.log("Attempting to fetch Modules ");
    const modules = await dbService.getCurriculumModules();
    console.log("Modules fetched successfully");
    res.json(modules);
  } catch (error) {
    console.error("Error fetching modules", error);
    res.status(500).json({ message: "Error fetching modules", error });
  }
});

// Get total number of modules
router.get("/count/total", async (req, res) => {
  try {
    const modules = await dbService.getCurriculumModules();

    const count = modules.length;
    res.json({ count });
  } catch (error) {
    console.error("Error counting modules", error);
    res.status(500).json({ message: "Error counting modules", error });
  }
});

// Get module by ID - moved this to be last
router.get("/:id", async (req, res) => {
  try {
    const module = await dbService.getCurriculumModuleById(req.params.id);
    if (!module) {
      res.status(404).json({ message: "Module not found" });
      return;
    }
    res.json(module);
  } catch (error) {
    console.error("Error fetching module", error);
    res.status(500).json({ message: "Error fetching module", error });
  }
});

export default router;
