/**
 * Multi-site vector store service for managing site-specific embeddings in PostgreSQL
 */

import { embedText } from "./embedding";
import { TextChunk } from "./textChunking";
import { SiteConfig } from "../types/wordpress";
import { prisma } from "../config/database";
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

/**
 * Generate collection name for a site (for compatibility)
 */
const getCollectionName = (siteId: string): string => {
  // Sanitize site ID for collection name (alphanumeric and underscores only)
  const sanitizedSiteId = siteId.replace(/[^a-zA-Z0-9_]/g, "_");
  return `site_${sanitizedSiteId}_chunks`;
};

/**
 * Convert embedding output to number array
 */
const convertToNumberArray = (embedding: number[]): number[] => {
  if (Array.isArray(embedding)) {
    if (embedding.length === 0) {
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
 * Initialize collection for a specific site (no-op for PostgreSQL)
 */
export const initSiteCollection = async (siteId: string): Promise<string> => {
  const collectionName = getCollectionName(siteId);
  console.log(`Site ${siteId} chunks managed via PostgreSQL PostChunk table`);
  return collectionName;
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

        // Convert embedding array to PostgreSQL vector format
        const embeddingVector = `[${embedding.join(",")}]`;

        // Use findFirst/create pattern instead of upsert
        const existingChunk = await prisma.postChunk.findFirst({
          where: { chunk_id: chunk.id },
        });

                 if (existingChunk) {
           // Use raw SQL for updating with vector data
           await prisma.$executeRaw`
             UPDATE post_chunks 
             SET post_title = ${chunk.postTitle},
                 post_url = ${chunk.postUrl},
                 chunk_index = ${chunk.chunkIndex},
                 content = ${chunk.content},
                 embedding = ${embeddingVector}::vector,
                 updated_at = NOW()
             WHERE id = ${existingChunk.id}
           `;
         } else {
           // Use raw SQL for creating with vector data
           await prisma.$executeRaw`
             INSERT INTO post_chunks (id, chunk_id, site_id, post_id, post_title, post_url, chunk_index, content, embedding, created_at, updated_at)
             VALUES (gen_random_uuid(), ${chunk.id}, ${siteId}, ${chunk.postId}, ${chunk.postTitle}, ${chunk.postUrl}, ${chunk.chunkIndex}, ${chunk.content}, ${embeddingVector}::vector, NOW(), NOW())
           `;
         }

        console.log(`Successfully upserted chunk ${chunk.id}`);
      } catch (error) {
        console.error(`Failed to embed chunk ${chunk.id}:`, error);
        continue; // Skip this chunk rather than failing the whole process
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
  const thresholdStr = ENV.SEARCH_THRESHOLD || "0.5"; // Default to 0.5 if not set
  const threshold = parseFloat(thresholdStr);
  console.log(
    `Querying similar posts for site ${siteId} with threshold:`,
    threshold
  );

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
      site_id: string;
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
        site_id,
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
      site_id: string;
      chunk_index: number;
      content: string;
      similarity: number;
    }) => {
      const chunk: StoredPostChunk = {
        id: result.chunk_id,
        postId: result.post_id,
        postTitle: result.post_title,
        postUrl: result.post_url,
        siteId: result.site_id,
        siteName: undefined, // Would need to join with Site table if needed
        siteUrl: undefined, // Would need to join with Site table if needed
        chunkIndex: result.chunk_index,
        content: result.content,
        score: result.similarity,
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
  } catch (error) {
    console.error(`Error querying similar posts for site ${siteId}:`, error);
    throw error;
  }
};

/**
 * Get count of chunks for a specific site
 */
export const getSiteChunksCount = async (siteId: string): Promise<number> => {
  try {
    console.log(`Getting chunk count for site ${siteId}`);

    // Use raw SQL to count chunks with embeddings
    const result = await prisma.$queryRaw<{count: string}[]>`
      SELECT COUNT(*)::text as count
      FROM post_chunks 
      WHERE site_id = ${siteId} AND embedding IS NOT NULL
    `;
    const count = parseInt(result[0]?.count || '0');

    return count;
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
 * Flush collection for a specific site (no-op for PostgreSQL)
 */
export const flushSiteCollection = async (siteId: string): Promise<void> => {
  console.log(`PostgreSQL auto-commits, no manual flush needed for site ${siteId}`);
  // No-op - PostgreSQL auto-commits transactions
};

/**
 * List all site collections
 */
export const listSiteCollections = async (): Promise<SiteConfig[]> => {
  try {
    // Get unique sites from post_chunks table with chunk counts
    // Use raw SQL to count chunks with embeddings per site
    const sitesWithChunks = await prisma.$queryRaw<{site_id: string, count: string}[]>`
      SELECT site_id, COUNT(*)::text as count
      FROM post_chunks 
      WHERE embedding IS NOT NULL
      GROUP BY site_id
    `;

    const siteCollections: SiteConfig[] = [];

          for (const siteData of sitesWithChunks) {
        const siteId = siteData.site_id;
        const chunkCount = parseInt(siteData.count) || 0;

      // Try to get site details from the Site table
      const siteDetails = await prisma.site.findUnique({
        where: { id: siteId },
        select: { name: true, url: true, created_at: true, updated_at: true },
      });

      siteCollections.push({
        site_id: siteId,
        site_name: siteDetails?.name || siteId,
        site_url: siteDetails?.url || "",
        collection_name: getCollectionName(siteId),
        created_at: siteDetails?.created_at?.toISOString() || new Date().toISOString(),
        updated_at: siteDetails?.updated_at?.toISOString() || new Date().toISOString(),
        chunk_count: chunkCount,
      });
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
    const chunkCount = await getSiteChunksCount(siteId);

    return {
      siteId,
      collectionName,
      chunkCount,
      exists: chunkCount > 0,
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
