import { embedText } from "./embedding";
import { TextChunk } from "./textChunking";
import { FeatureExtractionOutput } from "@huggingface/inference";
import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import { ENV } from "../config/env";

interface StoredPostChunk {
  id: string;
  postId: number;
  postTitle: string;
  postUrl: string;
  chunkIndex: number;
  content: string;
  score: number;
}

interface PostSearchResult {
  postId: number;
  postTitle: string;
  postUrl: string;
  matchingChunks: Array<{
    chunkId: string;
    chunkIndex: number;
    content: string;
    score: number;
  }>;
  maxScore: number;
  totalChunks: number;
}

// Add this to log connection attempts
console.log(
  "Initializing Milvus client for posts with address:",
  ENV.MILVUS_ADDRESS || "standalone:19530"
);

const milvusClient = new MilvusClient({
  address: ENV.MILVUS_ADDRESS || "standalone:19530",
  username: ENV.MILVUS_USERNAME || "",
  password: ENV.MILVUS_PASSWORD || "",
  timeout: 60000, // 60 seconds
});

const COLLECTION_NAME = "post_chunks";

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
 * Upserts a single text chunk into the vector store
 */
export const upsertPostChunk = async (chunk: TextChunk): Promise<void> => {
  try {
    console.log("Beginning upsert for chunk:", chunk.id);

    // Get embedding for the chunk content
    let embedding: number[];
    try {
      const embeddingResult = await embedText(chunk.content);
      console.log("Embedding dimension:", embeddingResult.length);

      if (!embeddingResult.length) {
        console.error(
          "Error: Received empty embedding vector - skipping chunk"
        );
        return;
      }

      embedding = embeddingResult;
    } catch (error) {
      console.error(`Failed to embed chunk ${chunk.id}:`, error);
      return; // Skip this chunk rather than failing the whole process
    }

    try {
      await handleCollectionCreation();
      console.log("About to insert chunk data into Milvus");

      const insertResult = await milvusClient.insert({
        collection_name: COLLECTION_NAME,
        data: [
          {
            // pk_id is autoID, so we don't need to provide it
            chunk_id: chunk.id,
            post_id: chunk.postId,
            post_title: chunk.postTitle,
            post_url: chunk.postUrl,
            chunk_index: chunk.chunkIndex,
            content: chunk.content,
            embedding: embedding,
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

      console.log(`Upserted post chunk ID: ${chunk.id} into Milvus`);
    } catch (dbError) {
      console.error("Database operation failed:", dbError);
      throw dbError;
    }
  } catch (error) {
    console.error("Error upserting post chunk:", error);
    throw error;
  }
};

/**
 * Upserts multiple text chunks in batch
 */
export const upsertPostChunks = async (
  chunks: TextChunk[],
  logEmbeddings: boolean = false
): Promise<void> => {
  console.log(`Starting batch upsert of ${chunks.length} chunks`);

  const embeddingsLog: Array<{
    chunkId: string;
    postId: number;
    chunkIndex: number;
    contentLength: number;
    embeddingDimension: number;
    embedding: number[];
  }> = [];

  for (const chunk of chunks) {
    if (logEmbeddings) {
      // Get embedding for logging
      try {
        const embeddingResult = await embedText(chunk.content);
        embeddingsLog.push({
          chunkId: chunk.id,
          postId: chunk.postId,
          chunkIndex: chunk.chunkIndex,
          contentLength: chunk.content.length,
          embeddingDimension: embeddingResult.length,
          embedding: embeddingResult,
        });
      } catch (error) {
        console.error(
          `Failed to get embedding for logging chunk ${chunk.id}:`,
          error
        );
      }
    }

    await upsertPostChunk(chunk);
  }

  // Log embeddings if requested
  if (logEmbeddings && embeddingsLog.length > 0) {
    const { promises: fs } = await import("fs");
    const path = await import("path");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const embeddingsFilename = `embeddings-${timestamp}.json`;
    const embeddingsFilePath = path.join(
      process.cwd(),
      "logs",
      embeddingsFilename
    );

    const embeddingsData = {
      timestamp: new Date().toISOString(),
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
  await flushCollection();

  console.log(`Completed batch upsert of ${chunks.length} chunks`);
};

/**
 * Query Milvus for similar post chunks, using COSINE similarity.
 * Returns posts grouped by post ID with their matching chunks.
 */
export const querySimilarPosts = async (
  query: string,
  topK: number = 10
): Promise<PostSearchResult[]> => {
  const thresholdStr = ENV.THRESHOLD;
  if (!thresholdStr) {
    throw new Error("THRESHOLD environment variable is not defined");
  }
  const threshold = parseFloat(thresholdStr);
  console.log("Querying similar posts with threshold:", threshold);

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
    output_fields: [
      "chunk_id",
      "post_id",
      "post_title",
      "post_url",
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
    const postId = result.post_id as number;
    const chunk: StoredPostChunk = {
      id: result.chunk_id as string,
      postId: postId,
      postTitle: result.post_title as string,
      postUrl: result.post_url as string,
      chunkIndex: result.chunk_index as number,
      content: result.content as string,
      score: result.score,
    };

    if (!postGroups.has(postId)) {
      postGroups.set(postId, []);
    }
    postGroups.get(postId)!.push(chunk);
  });

  // Convert to PostSearchResult format
  const results: PostSearchResult[] = Array.from(postGroups.entries()).map(
    ([postId, chunks]) => {
      // Sort chunks by score (highest first)
      chunks.sort((a, b) => b.score - a.score);

      return {
        postId,
        postTitle: chunks[0].postTitle,
        postUrl: chunks[0].postUrl,
        matchingChunks: chunks.map((chunk) => ({
          chunkId: chunk.id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: chunk.score,
        })),
        maxScore: chunks[0].score,
        totalChunks: chunks.length,
      };
    }
  );

  // Sort results by max score (highest first)
  results.sort((a, b) => b.maxScore - a.maxScore);

  console.log(`Returning ${results.length} posts with matching chunks`);
  return results;
};

/**
 * Initialize the Milvus collection for post chunks
 */
export const initPostChunksCollection = async () => {
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
    console.error("Failed to initialize post chunks collection:", error);
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
            name: "chunk_id",
            data_type: DataType.VarChar,
            max_length: 128,
          },
          {
            name: "post_id",
            data_type: DataType.Int64,
            autoID: false,
          },
          {
            name: "post_title",
            data_type: DataType.VarChar,
            max_length: 512,
          },
          {
            name: "post_url",
            data_type: DataType.VarChar,
            max_length: 512,
          },
          {
            name: "chunk_index",
            data_type: DataType.Int64,
            autoID: false,
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
    console.error("Failed to create/load post chunks collection:", error);
    throw error;
  }
};

/**
 * Get the count of embedded post chunks
 */
export const getPostChunksCount = async (): Promise<number> => {
  try {
    console.log("Beginning getPostChunksCount");
    await handleCollectionCreation();

    // Check if collection exists
    const exists = await milvusClient.hasCollection({
      collection_name: COLLECTION_NAME,
    });
    console.log(`Collection ${COLLECTION_NAME} exists:`, exists);

    if (!exists.value) {
      return 0;
    }

    // Ensure all inserted data is flushed
    await milvusClient.flush({
      collection_names: [COLLECTION_NAME],
    });

    // Get statistics
    const stats = await milvusClient.getCollectionStatistics({
      collection_name: COLLECTION_NAME,
    });

    console.log("Raw statistics:", JSON.stringify(stats, null, 2));

    const rowCount =
      stats.stats.find((stat) => stat.key === "row_count")?.value || "0";
    return parseInt(rowCount.toString());
  } catch (error) {
    console.error("Error getting post chunks count:", error);
    return 0;
  }
};

/**
 * Drop the post chunks collection
 */
export const dropPostChunksCollection = async () => {
  try {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    console.log("Post chunks collection dropped");
  } catch (error) {
    console.error("Failed to drop post chunks collection:", error);
    throw error;
  }
};

/**
 * Flush the collection to persist all data
 */
export const flushCollection = async (): Promise<void> => {
  try {
    console.log("Manually flushing post chunks collection to persist all data");
    const flushResult = await milvusClient.flush({
      collection_names: [COLLECTION_NAME],
    });
    console.log("Batch flush result:", flushResult);

    if (
      flushResult.status?.code !== 0 &&
      flushResult.status?.code !== undefined
    ) {
      console.warn(
        "Batch flush warning:",
        flushResult.status?.reason || "Unknown warning"
      );
    } else {
      console.log("Batch flush completed successfully");
    }
  } catch (flushError) {
    console.warn("Batch flush operation failed:", flushError);
    throw flushError;
  }
};
