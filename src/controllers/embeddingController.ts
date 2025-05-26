import { RequestHandler } from "express";
// Legacy curriculum imports - keeping for potential future use
// import {
//   upsertCurriculumBlock,
//   querySimilarModules,
//   getEmbeddingCount,
//   dropCollection as dropVectorStoreCollection,
//   flushCollection,
// } from "../services/vectorStore";

import {
  reconstructChunkedPosts,
  validateChunkedPosts,
} from "../services/wordpress";
import {
  extractTextFromPosts,
  getTextStats,
} from "../services/wordpress/posts";
import {
  createBatchPostChunks,
  getChunkingStats,
} from "../services/textChunking";
import {
  upsertSiteChunks,
  querySimilarSitePosts,
  getSiteChunksCount,
  dropSiteCollection,
  listSiteCollections,
  getSiteStats,
} from "../services/multiSiteVectorStore";
import { EmbedBatchRequest } from "../types/wordpress";
import { promises as fs } from "fs";
import path from "path";

export const searchPosts: RequestHandler = async (req, res) => {
  try {
    console.log("Searching posts using query:", req.body.query);
    const { query, topK, site_id } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        message: "Query parameter is required",
      });
      return;
    }

    if (!site_id) {
      res.status(400).json({
        success: false,
        message: "Site ID parameter is required",
      });
      return;
    }

    // Search for similar posts within the specified site
    const similarPosts = await querySimilarSitePosts(
      site_id,
      query,
      topK || 10
    );

    // Check if we found any results
    if (similarPosts.length === 0) {
      console.log(
        `No matching posts found for query: ${query} in site: ${site_id}`
      );
      res.json({
        success: true,
        results: [],
        message: "No matching content found for your query.",
        site_id: site_id,
      });
      return;
    }

    res.json({
      success: true,
      results: similarPosts,
      site_id: site_id,
      totalPosts: similarPosts.length,
      totalChunks: similarPosts.reduce(
        (sum: number, post: any) => sum + post.totalChunks,
        0
      ),
    });
  } catch (error) {
    console.error("Error searching posts:", error);

    // More specific error messages based on error type
    if (error instanceof Error) {
      // Handle the specific "Not Found" error from embedding service
      if (error.message.includes("Not Found")) {
        res.status(404).json({
          success: false,
          message:
            "Post content has not been embedded yet. Please embed posts first.",
          error: "POSTS_NOT_EMBEDDED",
        });
      } else if (error.message.includes("THRESHOLD")) {
        res.status(500).json({
          success: false,
          message:
            "Configuration error: THRESHOLD environment variable is not properly set",
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to search posts",
          error: error.message,
        });
      }
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to search posts",
        error: "Unknown error",
      });
    }
  }
};

export const embedTest: RequestHandler = async (req, res) => {
  try {
    const batchData: EmbedBatchRequest = req.body;

    // Validate the batch request structure
    if (!batchData.posts || !Array.isArray(batchData.posts)) {
      res.status(400).json({
        success: false,
        message:
          "Invalid request format. Expected 'posts' array in request body.",
      });
      return;
    }

    if (!batchData.site_id) {
      res.status(400).json({
        success: false,
        message: "Site ID is required in request body.",
      });
      return;
    }

    // Validate chunked posts before processing
    const validation = validateChunkedPosts(batchData.posts);
    if (!validation.isValid) {
      console.warn("Missing chunks detected:", validation.missingChunks);
      res.status(400).json({
        success: false,
        message: "Incomplete chunked posts detected",
        missingChunks: validation.missingChunks,
      });
      return;
    }

    // Reconstruct chunked posts
    const reconstructedPosts = reconstructChunkedPosts(batchData.posts);

    // Extract clean text from posts
    const postsWithExtractedText = extractTextFromPosts(reconstructedPosts);

    // Generate statistics for each post
    const postsWithStats = postsWithExtractedText.map((post) => ({
      ...post,
      textStats: getTextStats(post.extractedText),
    }));

    // Create text chunks from posts
    const textChunks = createBatchPostChunks(postsWithStats);
    const chunkingStats = getChunkingStats(textChunks);

    // Send immediate response to prevent timeout
    const processingStartTime = new Date().toISOString();
    console.log(
      `Starting embedding process for ${textChunks.length} chunks at ${processingStartTime}`
    );

    // Calculate overall statistics for immediate response
    const totalStats = postsWithStats.reduce(
      (acc, post) => ({
        totalWordCount: acc.totalWordCount + post.textStats.wordCount,
        totalCharacterCount:
          acc.totalCharacterCount + post.textStats.characterCount,
        totalParagraphCount:
          acc.totalParagraphCount + post.textStats.paragraphCount,
      }),
      { totalWordCount: 0, totalCharacterCount: 0, totalParagraphCount: 0 }
    );

    // Send immediate response with processing status
    res.json({
      success: true,
      message: `Embedding process started for ${textChunks.length} chunks. Processing will continue in background.`,
      status: "processing",
      processingStarted: processingStartTime,
      siteId: batchData.site_id,
      siteName: batchData.site_name,
      siteUrl: batchData.site_url,
      originalPostCount: batchData.posts.length,
      reconstructedPostCount: reconstructedPosts.length,
      processedPostCount: postsWithStats.length,
      overallStats: {
        ...totalStats,
        averageWordsPerPost: Math.round(
          totalStats.totalWordCount / postsWithStats.length
        ),
        averageParagraphsPerPost: Math.round(
          totalStats.totalParagraphCount / postsWithStats.length
        ),
      },
      chunkingStats: {
        totalChunks: chunkingStats.totalChunks,
        averageChunkSize: chunkingStats.averageChunkSize,
        chunksPerPost: chunkingStats.chunksPerPost,
        sentenceCompleteness: chunkingStats.sentenceCompleteness,
      },
      estimatedCompletionTime: `${Math.ceil(textChunks.length / 10)} minutes`,
    });

    // Continue processing in background (don't await)
    setImmediate(async () => {
      try {
        // Log chunks to separate file for analysis
        const chunksTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const chunksFilename = `chunks-${batchData.site_id}-${chunksTimestamp}.json`;
        const chunksFilePath = path.join(process.cwd(), "logs", chunksFilename);

        const chunksData = {
          timestamp: new Date().toISOString(),
          siteId: batchData.site_id,
          siteName: batchData.site_name,
          siteUrl: batchData.site_url,
          totalChunks: textChunks.length,
          chunkingStats,
          chunks: textChunks.map((chunk) => ({
            id: chunk.id,
            postId: chunk.postId,
            postTitle: chunk.postTitle,
            postUrl: chunk.postUrl,
            siteId: chunk.siteId,
            siteName: chunk.siteName,
            siteUrl: chunk.siteUrl,
            chunkIndex: chunk.chunkIndex,
            contentLength: chunk.content.length,
            content: chunk.content,
            startPosition: chunk.startPosition,
            endPosition: chunk.endPosition,
          })),
        };

        await fs.writeFile(
          chunksFilePath,
          JSON.stringify(chunksData, null, 2),
          "utf8"
        );
        console.log(`Chunks data written to: ${chunksFilePath}`);

        // Embed the chunks into the vector store
        console.log(
          `Embedding ${textChunks.length} chunks into vector store for site ${batchData.site_id}...`
        );
        await upsertSiteChunks(batchData.site_id, textChunks, true); // Enable embeddings logging
        console.log("Successfully embedded all chunks");

        // Create data object with processed information and timestamp
        const requestData = {
          timestamp: new Date().toISOString(),
          processingStarted: processingStartTime,
          processingCompleted: new Date().toISOString(),
          method: req.method,
          url: req.url,
          headers: req.headers,
          siteId: batchData.site_id,
          siteName: batchData.site_name,
          siteUrl: batchData.site_url,
          originalPostCount: batchData.posts.length,
          reconstructedPostCount: reconstructedPosts.length,
          processedPostCount: postsWithStats.length,
          overallStats: {
            ...totalStats,
            averageWordsPerPost: Math.round(
              totalStats.totalWordCount / postsWithStats.length
            ),
            averageParagraphsPerPost: Math.round(
              totalStats.totalParagraphCount / postsWithStats.length
            ),
          },
          chunkingStats: {
            totalChunks: chunkingStats.totalChunks,
            averageChunkSize: chunkingStats.averageChunkSize,
            chunksPerPost: chunkingStats.chunksPerPost,
            sentenceCompleteness: chunkingStats.sentenceCompleteness,
          },
          posts: postsWithStats.map((post) => ({
            id: post.id,
            type: post.type,
            title: post.title,
            cleanTitle: post.cleanTitle,
            url: post.url,
            rawContent: post.content,
            extractedText: post.extractedText,
            textStats: post.textStats,
            // Show comparison lengths
            rawContentLength: post.content.length,
            extractedTextLength: post.extractedText.length,
            compressionRatio: Math.round(
              (post.extractedText.length / post.content.length) * 100
            ),
          })),
          query: req.query,
          params: req.params,
        };

        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `embed-batch-request-${batchData.site_id}-${timestamp}.json`;
        const filePath = path.join(process.cwd(), "logs", filename);

        // Ensure logs directory exists
        const logsDir = path.join(process.cwd(), "logs");
        await fs.mkdir(logsDir, { recursive: true });

        // Write processed data to JSON file
        await fs.writeFile(
          filePath,
          JSON.stringify(requestData, null, 2),
          "utf8"
        );

        console.log(`Batch request data written to: ${filePath}`);
        console.log(
          `Processed ${batchData.posts.length} original posts into ${reconstructedPosts.length} reconstructed posts`
        );
        console.log(
          `Extracted text from ${postsWithStats.length} posts. Total words: ${totalStats.totalWordCount}, Total characters: ${totalStats.totalCharacterCount}`
        );
        console.log(
          `Created ${chunkingStats.totalChunks} chunks with average size ${chunkingStats.averageChunkSize} characters (${chunkingStats.sentenceCompleteness}% complete sentences)`
        );

        // Log individual post processing results
        postsWithStats.forEach((post, index) => {
          const compressionRatio = Math.round(
            (post.extractedText.length / post.content.length) * 100
          );
          const chunksForPost = chunkingStats.chunksPerPost[post.id] || 0;
          console.log(
            `Post ${index + 1} (ID: ${post.id}): ${
              post.textStats.wordCount
            } words, ${
              post.textStats.characterCount
            } chars, ${compressionRatio}% compression, ${chunksForPost} chunks`
          );
        });

        console.log(
          `Background embedding process completed successfully for site ${batchData.site_id}`
        );
      } catch (backgroundError) {
        console.error(
          "Error in background embedding process:",
          backgroundError
        );
      }
    });
  } catch (error) {
    console.error("Error processing batch request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process batch request",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getSiteChunksCountController: RequestHandler = async (
  req,
  res
) => {
  try {
    const { site_id } = req.params;

    if (!site_id) {
      res.status(400).json({
        success: false,
        message: "Site ID parameter is required",
      });
      return;
    }

    const count = await getSiteChunksCount(site_id);
    res.json({
      success: true,
      site_id: site_id,
      count: count,
    });
  } catch (error) {
    console.error("Error getting site chunks count:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get site chunks count",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const dropSiteCollectionController: RequestHandler = async (
  req,
  res
) => {
  try {
    const { site_id } = req.params;

    if (!site_id) {
      res.status(400).json({
        success: false,
        message: "Site ID parameter is required",
      });
      return;
    }

    await dropSiteCollection(site_id);
    res.json({
      success: true,
      message: `Site collection dropped for site: ${site_id}`,
      site_id: site_id,
    });
  } catch (error) {
    console.error("Error dropping site collection:", error);
    res.status(500).json({
      success: false,
      message: "Failed to drop site collection",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const listSiteCollectionsController: RequestHandler = async (
  req,
  res
) => {
  try {
    const sites = await listSiteCollections();
    res.json({
      success: true,
      sites: sites,
      total: sites.length,
    });
  } catch (error) {
    console.error("Error listing site collections:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list site collections",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getSiteStatsController: RequestHandler = async (req, res) => {
  try {
    const { site_id } = req.params;

    if (!site_id) {
      res.status(400).json({
        success: false,
        message: "Site ID parameter is required",
      });
      return;
    }

    const stats = await getSiteStats(site_id);
    res.json({
      success: true,
      stats: stats,
    });
  } catch (error) {
    console.error("Error getting site stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get site stats",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getEmbeddingStatusController: RequestHandler = async (
  req,
  res
) => {
  try {
    const { site_id } = req.params;

    if (!site_id) {
      res.status(400).json({
        success: false,
        message: "Site ID parameter is required",
      });
      return;
    }

    // Get current stats to determine if embedding is complete
    const stats = await getSiteStats(site_id);
    const count = await getSiteChunksCount(site_id);

    // Check for recent log files to determine processing status
    const logsDir = path.join(process.cwd(), "logs");
    let recentEmbeddingFiles: string[] = [];

    try {
      const files = await fs.readdir(logsDir);
      const embeddingFiles = files.filter(
        (file) =>
          file.includes(`embeddings-${site_id}-`) && file.endsWith(".json")
      );

      // Sort by modification time (most recent first)
      const fileStats = await Promise.all(
        embeddingFiles.map(async (file) => {
          const filePath = path.join(logsDir, file);
          const stat = await fs.stat(filePath);
          return { file, mtime: stat.mtime };
        })
      );

      recentEmbeddingFiles = fileStats
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
        .slice(0, 3)
        .map((item) => item.file);
    } catch (logError) {
      console.warn("Could not read logs directory:", logError);
    }

    res.json({
      success: true,
      site_id: site_id,
      status: count > 0 ? "completed" : "not_started",
      chunksCount: count,
      stats: stats,
      recentEmbeddingLogs: recentEmbeddingFiles,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting embedding status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get embedding status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
