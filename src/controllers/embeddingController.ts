import { RequestHandler } from "express";
import { dbService } from "../services/database";
import {
  upsertCurriculumModule,
  querySimilarModules,
  getEmbeddingCount,
  dropCollection as dropVectorStoreCollection,
} from "../services/vectorStore";

export const embedCurriculumContent: RequestHandler = async (req, res) => {
  try {
    // Fetch all curriculum modules from the database
    const modules = await dbService.getCurriculumModules();

    // Embed and store each module
    for (const module of modules) {
      await upsertCurriculumModule(module);
    }

    res.json({
      success: true,
      message: `Successfully embedded ${modules.length} curriculum modules`,
      count: modules.length,
    });
  } catch (error) {
    console.error("Error embedding curriculum content:", error);
    res.status(500).json({
      success: false,
      message: "Failed to embed curriculum content",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const searchCurriculumModules: RequestHandler = async (req, res) => {
  try {
    console.log("Searching curriculum modules using query:", req.body.query);
    const { query, topK } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        message: "Query parameter is required",
      });
      return;
    }

    // Search for similar modules
    const similarModules = await querySimilarModules(query, topK || 3);

    res.json({
      success: true,
      results: similarModules,
    });
  } catch (error) {
    console.error("Error searching curriculum modules:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search curriculum modules",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const embedTest: RequestHandler = async (req, res) => {
  try {
    // Fetch all curriculum modules from the database
    const modules = await dbService.getCurriculumModules();

    // Embed and store each module

    await upsertCurriculumModule(modules[0]);

    res.json({
      success: true,
      message: `Successfully embedded a test curriculum module`,
    });
  } catch (error) {
    console.error("Error embedding curriculum content during test:", error);
    res.status(500).json({
      success: false,
      message: "Failed to embed curriculum content",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getEmbeddingsCount: RequestHandler = async (req, res) => {
  try {
    const count = await getEmbeddingCount();
    res.json({
      success: true,
      count: count,
    });
  } catch (error) {
    console.error("Error getting embeddings count:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get embeddings count",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const dropCollection: RequestHandler = async (req, res) => {
  await dropVectorStoreCollection();
  res.json({ success: true, message: "Collection dropped" });
};
