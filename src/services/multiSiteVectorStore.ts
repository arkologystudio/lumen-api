/**
 * Multi-site vector store service for managing separate collections per site
 */

import { embedText } from "./embedding";
import { TextChunk } from "./textChunking";
import { SiteConfig } from "../types/wordpress";
import { FeatureExtractionOutput } from "@huggingface/inference";
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import { ENV } from "../config/env";

interface StoredPostChunk {
  id: string;
  postId: number;
  postTitle: string;
  postUrl: string;
  siteId: string;
  siteName?: string;
  siteUrl?: string;
  chunkIndex: number;
  content: string;
  score: number;
}

interface PostSearchResult {
  postId: number;
  postTitle: string;
  postUrl: string;
  siteId: string;
  siteName?: string;
  siteUrl?: string;
  averageScore: number;
  maxScore: number;
  totalChunks: number;
  chunks: Array<{
    chunkId: string;
    chunkIndex: number;
    content: string;
    score: number;
  }>;
}

// Initialize Milvus client
console.log(
  "Initializing Milvus client for multi-site with address:",
  ENV.MILVUS_ADDRESS || "standalone:19530"
);

const milvusClient = new MilvusClient({
  address: ENV.MILVUS_ADDRESS || "standalone:19530",
  username: ENV.MILVUS_USERNAME || "",
  password: ENV.MILVUS_PASSWORD || "",
  timeout: 60000, // 60 seconds
});

/**
 * Generate collection name for a site
 */
const getCollectionName = (siteId: string): string => {
  // Sanitize site ID for collection name (alphanumeric and underscores only)
  const sanitizedSiteId = siteId.replace(/[^a-zA-Z0-9_]/g, "_");
  return `site_${sanitizedSiteId}_chunks`;
};

/**
 * Convert embedding output to number array
 */
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

/**
 * Create collection schema for site chunks
 */
const createCollectionSchema = () => [
  {
    name: "pk_id",
    description: "Primary Key",
    data_type: DataType.Int64,
    is_primary_key: true,
    autoID: true,
  },
  {
    name: "chunk_id",
    description: "Chunk ID field",
    data_type: DataType.VarChar,
    max_length: 128,
  },
  {
    name: "post_id",
    description: "Post ID field",
    data_type: DataType.Int64,
    autoID: false,
  },
  {
    name: "post_title",
    description: "Post title field",
    data_type: DataType.VarChar,
    max_length: 512,
  },
  {
    name: "post_url",
    description: "Post URL field",
    data_type: DataType.VarChar,
    max_length: 512,
  },
  {
    name: "site_id",
    description: "Site ID field",
    data_type: DataType.VarChar,
    max_length: 128,
  },
  {
    name: "site_name",
    description: "Site name field",
    data_type: DataType.VarChar,
    max_length: 256,
  },
  {
    name: "site_url",
    description: "Site URL field",
    data_type: DataType.VarChar,
    max_length: 512,
  },
  {
    name: "chunk_index",
    description: "Chunk index within post",
    data_type: DataType.Int64,
    autoID: false,
  },
  {
    name: "content",
    description: "Chunk content field",
    data_type: DataType.VarChar,
    max_length: 65535,
  },
  {
    name: "embedding",
    description: "Vector field",
    data_type: DataType.FloatVector,
    dim: 1024, // Adjust if your actual embedding dimension is different
  },
];

/**
 * Initialize collection for a specific site
 */
export const initSiteCollection = async (siteId: string): Promise<string> => {
  const collectionName = getCollectionName(siteId);

  try {
    // Check if the collection already exists
    const hasCollection = await milvusClient.hasCollection({
      collection_name: collectionName,
    });

    // If it doesn't exist, create one
    if (!hasCollection.value) {
      await milvusClient.createCollection({
        collection_name: collectionName,
        fields: createCollectionSchema(),
      });

      // Create an index for vector search
      await milvusClient.createIndex({
        collection_name: collectionName,
        field_name: "embedding",
        index_type: "IVF_FLAT",
        metric_type: "COSINE", // Using cosine similarity
        params: { nlist: 1024 },
      });

      // Load collection into memory
      await milvusClient.loadCollection({
        collection_name: collectionName,
      });

      console.log(`Created and loaded collection: ${collectionName}`);
    } else {
      // Ensure collection is loaded
      await milvusClient.loadCollection({
        collection_name: collectionName,
      });
      console.log(`Collection already exists and loaded: ${collectionName}`);
    }

    return collectionName;
  } catch (error) {
    console.error(`Failed to initialize collection for site ${siteId}:`, error);
    throw error;
  }
};

/**
 * Upsert chunks for a specific site
 */
export const upsertSiteChunks = async (
  siteId: string,
  chunks: TextChunk[],
  logEmbeddings: boolean = false
): Promise<void> => {
  if (chunks.length === 0) {
    console.log("No chunks to upsert");
    return;
  }

  const collectionName = await initSiteCollection(siteId);
  console.log(`Upserting ${chunks.length} chunks for site ${siteId}`);

  const embeddingsLog: Array<{
    chunkId: string;
    embeddingDimension: number;
    embedding?: number[];
  }> = [];

  // Process chunks in batches to avoid memory issues
  const batchSize = 10;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
        chunks.length / batchSize
      )}`
    );

    const batchData = [];
    for (const chunk of batch) {
      try {
        // Get embedding for the chunk content
        const embeddingResult = await embedText(chunk.content);
        const embedding = convertToNumberArray(embeddingResult);

        if (!embedding.length) {
          console.error(
            `Error: Received empty embedding vector for chunk ${chunk.id} - skipping`
          );
          continue;
        }

        // Log embedding if requested
        if (logEmbeddings) {
          embeddingsLog.push({
            chunkId: chunk.id,
            embeddingDimension: embedding.length,
            embedding: embedding,
          });
        }

        batchData.push({
          chunk_id: chunk.id,
          post_id: chunk.postId,
          post_title: chunk.postTitle,
          post_url: chunk.postUrl,
          site_id: chunk.siteId,
          site_name: chunk.siteName || "",
          site_url: chunk.siteUrl || "",
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          embedding: embedding,
        });
      } catch (error) {
        console.error(`Failed to embed chunk ${chunk.id}:`, error);
        continue; // Skip this chunk rather than failing the whole process
      }
    }

    if (batchData.length > 0) {
      try {
        const insertResult = await milvusClient.insert({
          collection_name: collectionName,
          data: batchData,
        });

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

        console.log(
          `Successfully inserted batch of ${batchData.length} chunks`
        );
      } catch (dbError) {
        console.error("Database operation failed:", dbError);
        throw dbError;
      }
    }
  }

  // Log embeddings if requested
  if (logEmbeddings && embeddingsLog.length > 0) {
    const { promises: fs } = await import("fs");
    const path = await import("path");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const embeddingsFilename = `embeddings-${siteId}-${timestamp}.json`;
    const embeddingsFilePath = path.join(
      process.cwd(),
      "logs",
      embeddingsFilename
    );

    const embeddingsData = {
      timestamp: new Date().toISOString(),
      siteId: siteId,
      totalEmbeddings: embeddingsLog.length,
      averageDimension:
        embeddingsLog.length > 0
          ? Math.round(
              embeddingsLog.reduce((sum, e) => sum + e.embeddingDimension, 0) /
                embeddingsLog.length
            )
          : 0,
      embeddings: embeddingsLog,
    };

    await fs.writeFile(
      embeddingsFilePath,
      JSON.stringify(embeddingsData, null, 2),
      "utf8"
    );
    console.log(`Embeddings data written to: ${embeddingsFilePath}`);
  }

  // Flush collection to ensure all data is persisted
  await flushSiteCollection(siteId);
  console.log(
    `Completed batch upsert of ${chunks.length} chunks for site ${siteId}`
  );
};

/**
 * Search for similar posts within a specific site
 */
export const querySimilarSitePosts = async (
  siteId: string,
  query: string,
  topK: number = 10
): Promise<PostSearchResult[]> => {
  const thresholdStr = ENV.THRESHOLD;
  if (!thresholdStr) {
    throw new Error("THRESHOLD environment variable is not defined");
  }
  const threshold = parseFloat(thresholdStr);
  console.log(
    `Querying similar posts for site ${siteId} with threshold:`,
    threshold
  );

  const collectionName = await initSiteCollection(siteId);

  // Embed the incoming query
  const queryEmbeddingResult = await embedText(query);
  const queryEmbedding = convertToNumberArray(queryEmbeddingResult);
  console.log("Query embedding success");

  // Search with COSINE similarity (higher = more similar)
  const searchResults = await milvusClient.search({
    collection_name: collectionName,
    vectors: [queryEmbedding],
    search_params: {
      anns_field: "embedding",
      topk: topK,
      params: JSON.stringify({ nprobe: 10 }),
      index_type: "IVF_FLAT",
      metric_type: "COSINE",
    },
    output_fields: [
      "chunk_id",
      "post_id",
      "post_title",
      "post_url",
      "site_id",
      "site_name",
      "site_url",
      "chunk_index",
      "content",
    ],
  });

  console.log("Search results", searchResults);

  // Filter out any results whose similarity is below our threshold
  const filteredResults = searchResults.results.filter(
    (r) => r.score >= threshold
  );

  // If no results pass the threshold, return an empty array
  if (filteredResults.length === 0) {
    console.log("No search results above threshold, returning []");
    return [];
  }

  // Group results by post ID
  const postGroups = new Map<number, StoredPostChunk[]>();

  filteredResults.forEach((result) => {
    const chunk: StoredPostChunk = {
      id: result.chunk_id,
      postId: result.post_id,
      postTitle: result.post_title,
      postUrl: result.post_url,
      siteId: result.site_id,
      siteName: result.site_name,
      siteUrl: result.site_url,
      chunkIndex: result.chunk_index,
      content: result.content,
      score: result.score,
    };

    if (!postGroups.has(chunk.postId)) {
      postGroups.set(chunk.postId, []);
    }
    postGroups.get(chunk.postId)!.push(chunk);
  });

  // Convert grouped results to PostSearchResult format
  const results: PostSearchResult[] = Array.from(postGroups.entries()).map(
    ([postId, chunks]) => {
      const sortedChunks = chunks.sort((a, b) => b.score - a.score);
      const totalScore = chunks.reduce((sum, chunk) => sum + chunk.score, 0);
      const averageScore = totalScore / chunks.length;
      const maxScore = Math.max(...chunks.map((chunk) => chunk.score));

      return {
        postId,
        postTitle: chunks[0].postTitle,
        postUrl: chunks[0].postUrl,
        siteId: chunks[0].siteId,
        siteName: chunks[0].siteName,
        siteUrl: chunks[0].siteUrl,
        averageScore: Math.round(averageScore * 1000) / 1000,
        maxScore: Math.round(maxScore * 1000) / 1000,
        totalChunks: chunks.length,
        chunks: sortedChunks.map((chunk) => ({
          chunkId: chunk.id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: Math.round(chunk.score * 1000) / 1000,
        })),
      };
    }
  );

  // Sort by max score descending
  return results.sort((a, b) => b.maxScore - a.maxScore);
};

/**
 * Get count of chunks for a specific site
 */
export const getSiteChunksCount = async (siteId: string): Promise<number> => {
  try {
    const collectionName = getCollectionName(siteId);
    console.log(`Getting chunk count for site ${siteId}`);

    // Check if collection exists
    const exists = await milvusClient.hasCollection({
      collection_name: collectionName,
    });

    if (!exists.value) {
      return 0;
    }

    // Ensure all inserted data is flushed
    await milvusClient.flush({
      collection_names: [collectionName],
    });

    // Get statistics
    const stats = await milvusClient.getCollectionStatistics({
      collection_name: collectionName,
    });

    const rowCount =
      stats.stats.find((stat) => stat.key === "row_count")?.value || "0";
    return parseInt(rowCount.toString());
  } catch (error) {
    console.error(`Error getting chunk count for site ${siteId}:`, error);
    return 0;
  }
};

/**
 * Drop collection for a specific site
 */
export const dropSiteCollection = async (siteId: string): Promise<void> => {
  try {
    const collectionName = getCollectionName(siteId);
    await milvusClient.dropCollection({ collection_name: collectionName });
    console.log(`Collection dropped for site ${siteId}: ${collectionName}`);
  } catch (error) {
    console.error(`Failed to drop collection for site ${siteId}:`, error);
    throw error;
  }
};

/**
 * Flush collection for a specific site
 */
export const flushSiteCollection = async (siteId: string): Promise<void> => {
  try {
    const collectionName = getCollectionName(siteId);
    console.log(`Flushing collection for site ${siteId}: ${collectionName}`);
    const flushResult = await milvusClient.flush({
      collection_names: [collectionName],
    });

    if (
      flushResult.status?.code !== 0 &&
      flushResult.status?.code !== undefined
    ) {
      console.warn(
        "Flush warning:",
        flushResult.status?.reason || "Unknown warning"
      );
    } else {
      console.log(`Flush completed successfully for site ${siteId}`);
    }
  } catch (flushError) {
    console.warn(`Flush operation failed for site ${siteId}:`, flushError);
    throw flushError;
  }
};

/**
 * List all site collections
 */
export const listSiteCollections = async (): Promise<SiteConfig[]> => {
  try {
    const collections = await milvusClient.listCollections();
    const siteCollections: SiteConfig[] = [];

    for (const collection of collections.data) {
      // Check if this is a site collection (starts with "site_" and ends with "_chunks")
      const collectionName = collection.name;
      const match = collectionName.match(/^site_(.+)_chunks$/);
      if (match) {
        const siteId = match[1].replace(/_/g, "-"); // Convert back from sanitized format
        const count = await getSiteChunksCount(siteId);

        siteCollections.push({
          site_id: siteId,
          site_name: siteId, // We don't store site name in collection, so use ID
          site_url: "", // We don't store site URL in collection
          collection_name: collectionName,
          created_at: new Date().toISOString(), // We don't track creation time
          updated_at: new Date().toISOString(), // We don't track update time
          chunk_count: count,
        });
      }
    }

    return siteCollections;
  } catch (error) {
    console.error("Error listing site collections:", error);
    return [];
  }
};

/**
 * Get site statistics
 */
export const getSiteStats = async (
  siteId: string
): Promise<{
  siteId: string;
  collectionName: string;
  chunkCount: number;
  exists: boolean;
}> => {
  const collectionName = getCollectionName(siteId);

  try {
    const exists = await milvusClient.hasCollection({
      collection_name: collectionName,
    });

    const chunkCount = exists.value ? await getSiteChunksCount(siteId) : 0;

    return {
      siteId,
      collectionName,
      chunkCount,
      exists: Boolean(exists.value),
    };
  } catch (error) {
    console.error(`Error getting stats for site ${siteId}:`, error);
    return {
      siteId,
      collectionName,
      chunkCount: 0,
      exists: false,
    };
  }
};
