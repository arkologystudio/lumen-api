import { embedText } from "./embedding";
import { TextChunk } from "./textChunking";
import { PrismaClient } from "@prisma/client";
import { ENV } from "../config/env";

// Initialize Prisma client
const prisma = new PrismaClient();

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
      console.log("About to upsert chunk data into PostgreSQL");

      // Convert embedding array to PostgreSQL vector format
      const embeddingVector = `[${embedding.join(",")}]`;

      // Use Prisma to upsert the chunk
      await prisma.postChunk.upsert({
        where: {
          chunk_id: chunk.id,
        },
        update: {
          post_title: chunk.postTitle,
          post_url: chunk.postUrl,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          embedding: embeddingVector as any, // Cast to any for Unsupported type
          updated_at: new Date(),
        },
        create: {
          chunk_id: chunk.id,
          site_id: chunk.siteId,
          post_id: chunk.postId,
          post_title: chunk.postTitle,
          post_url: chunk.postUrl,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          embedding: embeddingVector as any, // Cast to any for Unsupported type
        },
      });

      console.log(`Upserted post chunk ID: ${chunk.id} into PostgreSQL`);
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

  // Process in smaller batches to avoid memory issues
  const batchSize = 10;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);

    for (const chunk of batch) {
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

  console.log(`Completed batch upsert of ${chunks.length} chunks`);
};

/**
 * Query PostgreSQL for similar post chunks using pgvector cosine similarity.
 * Returns posts grouped by post ID with their matching chunks.
 */
export const querySimilarPosts = async (
  query: string,
  siteId: string,
  topK: number = 10
): Promise<PostSearchResult[]> => {
  const thresholdStr = ENV.SEARCH_THRESHOLD;
  if (!thresholdStr) {
    throw new Error("THRESHOLD environment variable is not defined");
  }
  const threshold = parseFloat(thresholdStr);
  console.log("Querying similar posts with threshold:", threshold);

  // Embed the incoming query
  const queryEmbeddingResult = await embedText(query);
  const queryEmbedding = `[${queryEmbeddingResult.join(",")}]`;
  console.log("Query embedding success");

  try {
    // Use raw SQL for vector similarity search with pgvector
    const searchResults = await prisma.$queryRaw<Array<{
      id: string;
      chunk_id: string;
      post_id: number;
      post_title: string;
      post_url: string;
      chunk_index: number;
      content: string;
      similarity: number;
    }>>`
      SELECT 
        id,
        chunk_id,
        post_id,
        post_title,
        post_url,
        chunk_index,
        content,
        (1 - (embedding <=> ${queryEmbedding}::vector)) as similarity
      FROM post_chunks 
      WHERE site_id = ${siteId}
        AND embedding IS NOT NULL
        AND (1 - (embedding <=> ${queryEmbedding}::vector)) >= ${threshold}
      ORDER BY embedding <=> ${queryEmbedding}::vector
      LIMIT ${topK}
    `;

    console.log("Search results", searchResults);

    // If no results pass the threshold, return an empty array
    if (searchResults.length === 0) {
      console.log("No search results above threshold, returning []");
      return [];
    }

    // Group results by post ID
    const postGroups = new Map<number, StoredPostChunk[]>();

         searchResults.forEach((result: {
       id: string;
       chunk_id: string;
       post_id: number;
       post_title: string;
       post_url: string;
       chunk_index: number;
       content: string;
       similarity: number;
     }) => {
       const chunk: StoredPostChunk = {
         id: result.chunk_id,
         postId: result.post_id,
         postTitle: result.post_title,
         postUrl: result.post_url,
         chunkIndex: result.chunk_index,
         content: result.content,
         score: result.similarity,
       };

      if (!postGroups.has(chunk.postId)) {
        postGroups.set(chunk.postId, []);
      }
      postGroups.get(chunk.postId)!.push(chunk);
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
  } catch (error) {
    console.error("Error querying similar posts:", error);
    throw error;
  }
};

/**
 * Initialize the PostgreSQL tables (handled by Prisma migrations)
 */
export const initPostChunksCollection = async () => {
  console.log("PostChunk table initialization handled by Prisma migrations");
  // No-op - tables are created via Prisma migrations
};

/**
 * Get the count of embedded post chunks for a site
 */
export const getPostChunksCount = async (siteId: string): Promise<number> => {
  try {
    console.log(`Getting post chunks count for site ${siteId}`);
    
    const count = await prisma.postChunk.count({
      where: {
        site_id: siteId,
        embedding: {
          not: null,
        },
      },
    });

    return count;
  } catch (error) {
    console.error("Error getting post chunks count:", error);
    return 0;
  }
};

/**
 * Drop post chunks for a specific site
 */
export const dropPostChunksCollection = async (siteId: string) => {
  try {
    await prisma.postChunk.deleteMany({
      where: {
        site_id: siteId,
      },
    });
    console.log(`Post chunks deleted for site ${siteId}`);
  } catch (error) {
    console.error(`Failed to delete post chunks for site ${siteId}:`, error);
    throw error;
  }
};

/**
 * No-op for PostgreSQL (auto-commit)
 */
export const flushCollection = async (): Promise<void> => {
  console.log("PostgreSQL auto-commits, no manual flush needed");
  // No-op - PostgreSQL auto-commits transactions
};
