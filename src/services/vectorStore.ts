import { embedText } from "./embedding";
import { CurriculumModule } from "./database";
import { FeatureExtractionOutput } from "@huggingface/inference";
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import { ENV } from "../config/env";
import { dbService } from "./database";

interface StoredCurriculumModule {
  id: number;
  embedding: number[];
  url: string;
  metadata: Record<string, string>;
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

export const upsertCurriculumModule = async (
  module: CurriculumModule
): Promise<void> => {
  try {
    const embeddingResult = await embedText(module.content);
    const embedding = convertToNumberArray(embeddingResult);
    console.log("Embedding dimension:", embedding.length);
    console.log("Embedding result", embeddingResult);

    await handleCollectionCreation();
    await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data: [
        {
          id: module.id,
          embedding: embedding,
          url: module.url,
        },
      ],
    });

    // Ensure data is persisted
    await milvusClient.flush({
      collection_names: [COLLECTION_NAME],
    });

    console.log(`Upserted curriculum module ID: ${module.id} into Milvus`);
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
  topK: number = 3,
  threshold: number = 0.8
): Promise<StoredCurriculumModule[]> => {
  console.log("Querying similar modules");
  await handleCollectionCreation(); // Ensure collection is ready

  // Embed the incoming query
  const queryEmbeddingResult = await embedText(query);
  console.log("Query embedding result", queryEmbeddingResult);

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
    output_fields: ["id"],
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

  // Fetch the matching modules from the DB
  const modules = await Promise.all(
    filteredResults.map(async (result) => {
      const moduleId = result.id;
      const module = await dbService.getCurriculumModuleById(moduleId);
      if (!module) {
        throw new Error(`Module with ID ${moduleId} not found in database`);
      }
      return {
        ...module,
        embedding: result.embedding as number[],
      };
    })
  );

  return modules;
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
        dimension: 384, // Adjust if your actual embedding dimension is different
        fields: [
          {
            name: "id",
            description: "ID field",
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: false,
          },
          {
            name: "embedding",
            description: "Vector field",
            data_type: DataType.FloatVector,
            dim: 384, // Adjust if your actual embedding dimension is different
          },
          {
            name: "url",
            description: "URL field",
            data_type: DataType.VarChar,
            max_length: 65535,
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
            name: "id",
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: false,
          },
          {
            name: "embedding",
            data_type: DataType.FloatVector,
            dim: 1024, // Use 1024 if your actual embeddings are size 1024
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
    } catch (indexError) {
      console.log("Index might already exist:", indexError.message);
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

export const getEmbeddingCount = async (): Promise<number> => {
  await handleCollectionCreation();

  // Ensure all inserted data is flushed
  await milvusClient.flush({
    collection_names: [COLLECTION_NAME],
  });

  const stats = await milvusClient.getCollectionStatistics({
    collection_name: COLLECTION_NAME,
  });
  console.log("Collection statistics:", stats);

  const rowCount =
    stats.stats.find((stat) => stat.key === "row_count")?.value || "0";
  console.log("Row count found:", rowCount);

  return parseInt(rowCount.toString());
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
