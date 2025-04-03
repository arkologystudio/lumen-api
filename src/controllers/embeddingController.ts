import { RequestHandler } from "express";
import {
  upsertCurriculumBlock,
  querySimilarModules,
  getEmbeddingCount,
  dropCollection as dropVectorStoreCollection,
} from "../services/vectorStore";
import { getCurriculumModulesWithBlocks } from "../services/wp_client";

export const embedCurriculumContent: RequestHandler = async (req, res) => {
  try {
    // Fetch all curriculum modules from the database
    const modules = await getCurriculumModulesWithBlocks();

    // Embed and store each module
    for (const module of modules) {
      for (const block of module.blocks) {
        await upsertCurriculumBlock(module, block);
      }
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

    // Check if we found any results
    if (similarModules.length === 0) {
      console.log("No matching modules found for query:", query);
      res.json({
        success: true,
        results: [],
        message: "No matching content found for your query.",
      });
      return;
    }

    res.json({
      success: true,
      results: similarModules,
    });
  } catch (error) {
    console.error("Error searching curriculum modules:", error);

    // More specific error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes("THRESHOLD")) {
        res.status(500).json({
          success: false,
          message:
            "Configuration error: THRESHOLD environment variable is not properly set",
          error: error.message,
        });
      } else if (error.message.includes("Failed to fetch curriculum module")) {
        res.status(500).json({
          success: false,
          message:
            "WordPress API error: Unable to fetch content from WordPress",
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to search curriculum modules",
          error: error.message,
        });
      }
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to search curriculum modules",
        error: "Unknown error",
      });
    }
  }
};

export const embedTest: RequestHandler = async (req, res) => {
  try {
    // Fetch all curriculum modules from the database
    const modules = await getCurriculumModulesWithBlocks();

    // Use the first module consistently for both module and blocks
    const testModule = modules[0];

    // Embed and store each block from the test module
    for (const block of testModule.blocks) {
      await upsertCurriculumBlock(testModule, block);
    }

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
