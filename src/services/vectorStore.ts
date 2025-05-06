import { embedText } from "./embedding";

import { FeatureExtractionOutput } from "@huggingface/inference";
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import { ENV } from "../config/env";
import { CurriculumModule, GutenbergBlock } from "../types";
import { getCurriculumModuleById } from "./wp_client";

interface StoredCurriculumModule {
  id: number;
  title: string;
  embedding: number[];
  url: string;
  metadata: {
    blocks: GutenbergBlock[];
    matchingBlocks: {
      blockId: string;
      content: string;
      score: number;
    }[];
  };
}

// Add this to log connection attempts
console.log(
  "Initializing Milvus client with address:",
  ENV.MILVUS_ADDRESS || "standalone:19530"
);

const milvusClient = new MilvusClient({
  address: ENV.MILVUS_ADDRESS || "standalone:19530",
  username: ENV.MILVUS_USERNAME || "",
  password: ENV.MILVUS_PASSWORD || "",
  timeout: 60000, // 60 seconds
});

const COLLECTION_NAME = "curriculum_modules";

const convertToNumberArray = (embedding: FeatureExtractionOutput): number[] => {
  if (typeof embedding === "number") {
    return [embedding];
  }

  if (Array.isArray(embedding)) {
    if (embedding.length === 0) {
      return [];
    }

    // Check if it's a 2D array by checking first element
    if (Array.isArray(embedding[0])) {
      // Verify all elements in first row are numbers
      if (embedding[0].every((item) => typeof item === "number")) {
        return embedding[0];
      }
      return [];
    }

    // For 1D array, verify all elements are numbers
    if (embedding.every((item) => typeof item === "number")) {
      return embedding;
    }
  }

  return [];
};

export const upsertCurriculumBlock = async (
  module: CurriculumModule,
  block: GutenbergBlock
): Promise<void> => {
  try {
    if (!block.attrs.id) {
      console.log("Block has no ID, skipping");
      return;
    }
    console.log(
      "Beginning upsert for module:",
      module.id,
      "block:",
      block.attrs.id
    );

    // Get embedding for the block
    let embedding: number[];
    try {
      const embeddingResult = await embedText(block.innerHTML);
      console.log("Embedding dimension:", embeddingResult.length);

      if (!embeddingResult.length) {
        console.error(
          "Error: Received empty embedding vector - skipping block"
        );
        return;
      }

      embedding = embeddingResult;
    } catch (error) {
      console.error(`Failed to embed block ${block.attrs.id}:`, error);
      return; // Skip this block rather than failing the whole process
    }

    try {
      await handleCollectionCreation();
      console.log("About to insert data into Milvus");

      const insertResult = await milvusClient.insert({
        collection_name: COLLECTION_NAME,
        data: [
          {
            // pk_id is autoID, so we don't need to provide it
            module_id: module.id,
            block_id: block.attrs.id,
            content: block.innerHTML,
            embedding: embedding,
            url: module.permalink,
          },
        ],
      });

      console.log("Insert result:", insertResult);

      if (insertResult.err_index && insertResult.err_index.length > 0) {
        console.error(
          "Insert errors:",
          insertResult.status?.reason || "Unknown error"
        );
        throw new Error(
          `Failed to insert data: ${
            insertResult.status?.reason || "Unknown error"
          }`
        );
      }

      // Ensure data is persisted
      console.log("Flushing collection to persist data");
      try {
        const flushResult = await milvusClient.flush({
          collection_names: [COLLECTION_NAME],
        });
        console.log("Flush result:", flushResult);

        if (
          flushResult.status?.code !== 0 &&
          flushResult.status?.code !== undefined
        ) {
          console.warn(
            "Flush warning:",
            flushResult.status?.reason || "Unknown warning"
          );
        }
      } catch (flushError) {
        console.warn("Flush operation failed, continuing anyway:", flushError);
        // Don't throw here, as the data is likely still inserted
      }

      // Get entity count right after insertion
      const count = await checkEntityCount();
      console.log(`Entity count after insertion: ${count}`);

      console.log(`Upserted curriculum module ID: ${module.id} into Milvus`);
    } catch (dbError) {
      console.error("Database operation failed:", dbError);
      throw dbError;
    }

    // Process innerBlocks recursively if they exist
    if (block.innerBlocks && block.innerBlocks.length > 0) {
      for (const innerBlock of block.innerBlocks) {
        await upsertCurriculumBlock(module, innerBlock);
      }
    }
  } catch (error) {
    console.error("Error upserting curriculum module:", error);
    throw error;
  }
};

/**
 * Query Milvus for similar modules, using COSINE similarity.
 * - topK: how many items to retrieve
 * - threshold: minimum similarity required to be considered a match
 */
export const querySimilarModules = async (
  query: string,
  topK: number = 3
): Promise<StoredCurriculumModule[]> => {
  const thresholdStr = ENV.THRESHOLD;
  if (!thresholdStr) {
    throw new Error("THRESHOLD environment variable is not defined");
  }
  const threshold = parseFloat(thresholdStr);
  console.log("Querying similar modules with threshold:", threshold);
  await handleCollectionCreation(); // Ensure collection is ready

  // Embed the incoming query
  const queryEmbeddingResult = await embedText(query);

  const queryEmbedding = convertToNumberArray(queryEmbeddingResult);
  console.log("Query embedding success");

  // Search with COSINE similarity (higher = more similar)
  const searchResults = await milvusClient.search({
    collection_name: COLLECTION_NAME,
    vectors: [queryEmbedding],
    search_params: {
      anns_field: "embedding",
      topk: topK,
      params: JSON.stringify({ nprobe: 10 }),
      index_type: "IVF_FLAT",
      metric_type: "COSINE",
    },
    output_fields: ["module_id", "block_id", "content", "url"],
  });

  console.log("Search results", searchResults);

  // Filter out any results whose similarity is below our threshold.
  // Remember: with COSINE, `score` is between 0 and 1, so we do score >= threshold.
  const filteredResults = searchResults.results.filter(
    (r) => r.score >= threshold
  );

  // If no results pass the threshold, return an empty array
  if (filteredResults.length === 0) {
    console.log("No search results above threshold, returning []");
    return [];
  }

  // Process results to get unique module IDs
  const moduleIdSet = new Set<number>();
  filteredResults.forEach((result) => {
    const moduleId = result.module_id;
    moduleIdSet.add(moduleId);
  });

  // Fetch the matching modules from the DB
  const modules = await Promise.all(
    Array.from(moduleIdSet).map(async (moduleId) => {
      try {
        const module = await getCurriculumModuleById(String(moduleId));
        if (!module) {
          console.warn(
            `Module with ID ${moduleId} not found in database, skipping`
          );
          return null;
        }

        // Get all blocks from this module that matched
        const matchingBlocks = filteredResults
          .filter((result) => result.module_id === moduleId)
          .map((result) => ({
            blockId: result.block_id as string,
            content: result.content,
            score: result.score,
          }));

        // Return in StoredCurriculumModule format
        const storedModule: StoredCurriculumModule = {
          id: module.id,
          title: module.title,
          embedding: [], // Not needed for return
          url: module.permalink,
          metadata: {
            blocks: module.blocks,
            matchingBlocks: matchingBlocks,
          },
        };

        console.log("Stored module: ", storedModule);

        return storedModule;
      } catch (error) {
        console.error(`Error fetching module with ID ${moduleId}:`, error);
        return null;
      }
    })
  );

  // Filter out any null modules (those that couldn't be found)
  console.log(
    "Blocks:",
    modules.map((module) => module?.metadata.matchingBlocks)
  );
  return modules.filter((module) => module !== null);
};

export const initMilvusCollection = async () => {
  try {
    // Check if the collection already exists
    const hasCollection = await milvusClient.hasCollection({
      collection_name: COLLECTION_NAME,
    });

    // If it doesn't exist, create one
    if (!hasCollection) {
      await milvusClient.createCollection({
        collection_name: COLLECTION_NAME,
        fields: [
          {
            name: "pk_id",
            description: "Primary Key",
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: true,
          },
          {
            name: "module_id",
            description: "Module ID field",
            data_type: DataType.Int64,
            autoID: false,
          },
          {
            name: "block_id",
            description: "Block ID field",
            data_type: DataType.VarChar,
            max_length: 64,
          },
          {
            name: "content",
            description: "Block content field",
            data_type: DataType.VarChar,
            max_length: 65535,
          },
          {
            name: "embedding",
            description: "Vector field",
            data_type: DataType.FloatVector,
            dim: 1024, // Adjust if your actual embedding dimension is different
          },
          {
            name: "url",
            description: "URL field",
            data_type: DataType.VarChar,
            max_length: 512,
          },
        ],
      });

      // Create an index for vector search
      await milvusClient.createIndex({
        collection_name: COLLECTION_NAME,
        field_name: "embedding",
        index_type: "IVF_FLAT",
        metric_type: "COSINE", // Using cosine similarity
        params: { nlist: 1024 },
      });

      // Load collection into memory
      await milvusClient.loadCollection({
        collection_name: COLLECTION_NAME,
      });
    }
  } catch (error) {
    console.error("Failed to initialize Milvus collection:", error);
    throw error;
  }
};

// Called by upsert/search to ensure collection is ready
const handleCollectionCreation = async () => {
  try {
    const exists = await milvusClient.hasCollection({
      collection_name: COLLECTION_NAME,
    });

    if (!exists.value) {
      await milvusClient.createCollection({
        collection_name: COLLECTION_NAME,
        fields: [
          {
            name: "pk_id",
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: true,
          },
          {
            name: "module_id",
            data_type: DataType.Int64,
            autoID: false,
          },
          {
            name: "block_id",
            data_type: DataType.VarChar,
            max_length: 64,
          },
          {
            name: "content",
            data_type: DataType.VarChar,
            max_length: 65535,
          },
          {
            name: "embedding",
            data_type: DataType.FloatVector,
            dim: 1024, // Use embedding dimension that matches your model
          },
          {
            name: "url",
            data_type: DataType.VarChar,
            max_length: 512,
          },
        ],
      });

      console.log("Created Milvus collection:", COLLECTION_NAME);
    }

    // Create the index if it doesn't exist
    try {
      await milvusClient.createIndex({
        collection_name: COLLECTION_NAME,
        field_name: "embedding",
        index_type: "IVF_FLAT",
        metric_type: "COSINE",
        params: { nlist: 1024 },
      });
      console.log("Created index on collection");
    } catch (indexError: unknown) {
      if (indexError instanceof Error) {
        console.log("Index might already exist:", indexError.message);
      } else {
        console.log("Index might already exist, unknown error format");
      }
    }

    // Load the collection into memory
    await milvusClient.loadCollection({
      collection_name: COLLECTION_NAME,
    });
    console.log("Loaded collection into memory");
  } catch (error) {
    console.error("Failed to create/load Milvus collection:", error);
    throw error;
  }
};

// Function to directly check entity count
const checkEntityCount = async (): Promise<number> => {
  try {
    // Ensure all inserted data is flushed
    await milvusClient.flush({
      collection_names: [COLLECTION_NAME],
    });

    // First check if collection exists
    const exists = await milvusClient.hasCollection({
      collection_name: COLLECTION_NAME,
    });
    console.log(`Collection ${COLLECTION_NAME} exists:`, exists);

    if (!exists.value) {
      return 0;
    }

    // Get statistics
    const stats = await milvusClient.getCollectionStatistics({
      collection_name: COLLECTION_NAME,
    });

    console.log("Raw statistics:", JSON.stringify(stats, null, 2));

    const rowCount =
      stats.stats.find((stat) => stat.key === "row_count")?.value || "0";
    return parseInt(rowCount.toString());
  } catch (error) {
    console.error("Error checking entity count:", error);
    return -1;
  }
};

export const getEmbeddingCount = async (): Promise<number> => {
  try {
    console.log("Beginning getEmbeddingCount");
    await handleCollectionCreation();

    // List all collections to see if our collection exists
    const collections = await milvusClient.listCollections();
    console.log("Available collections:", JSON.stringify(collections, null, 2));

    // Check if collection exists
    const exists = await milvusClient.hasCollection({
      collection_name: COLLECTION_NAME,
    });
    console.log(`Collection ${COLLECTION_NAME} exists:`, exists);

    // Get entity count directly
    return await checkEntityCount();
  } catch (error) {
    console.error("Error getting embedding count:", error);
    return 0;
  }
};

export const dropCollection = async () => {
  try {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    console.log("Collection dropped");
  } catch (error) {
    console.error("Failed to drop collection:", error);
    throw error;
  }
};
