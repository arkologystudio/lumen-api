import { RequestHandler } from "express";
import {
  getCurriculumModulesWithBlocks,
  getCurriculumModuleById,
} from "../services/wp_client";

export const getAllModules: RequestHandler = async (req, res) => {
  try {
    console.log("Attempting to fetch Modules ");

    const modules = await getCurriculumModulesWithBlocks();
    console.log("Modules fetched successfully");
    res.json(modules);
  } catch (error) {
    console.error("Error fetching modules", error);
    res.status(500).json({ message: "Error fetching modules", error });
  }
};

export const getModulesCount: RequestHandler = async (req, res) => {
  try {
    const modules = await getCurriculumModulesWithBlocks();

    const moduleCount = modules.length;
    const blockCount = modules.reduce((acc, module) => {
      return acc + module.blocks.length;
    }, 0);
    res.json({
      Modules: moduleCount,
      Blocks: blockCount,
    });
  } catch (error) {
    console.error("Error counting modules", error);
    res.status(500).json({ message: "Error counting modules", error });
  }
};

export const getModuleById: RequestHandler = async (req, res) => {
  try {
    const module = await getCurriculumModuleById(req.params.id);
    if (!module) {
      res.status(404).json({ message: "Module not found" });
      return;
    }
    res.json(module);
  } catch (error) {
    console.error("Error fetching module", error);
    res.status(500).json({ message: "Error fetching module", error });
  }
};
