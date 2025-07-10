import {
  createSite,
  updateSite,
  deleteSite,
  getSiteByIdForUser,
  getSiteStatistics,
  updateSiteEmbeddingStatus,
} from "../services/siteService";
import {
  upsertSiteChunks,
  querySimilarSitePosts,
} from "../services/multiSiteVectorStore";
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
import { CreateSiteRequest, UpdateSiteRequest } from "../types/index";
import { EmbedBatchRequest } from "../types/wordpress";
import { AuthenticatedRequest } from "../middleware/auth";

/**
 * Create a new site
 */
export const createSiteController = async (
  req: AuthenticatedRequest,
  res: any
) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const siteData: CreateSiteRequest = req.body;

    if (!siteData.name || !siteData.url) {
      res.status(400).json({
        success: false,
        error: "Site name and URL are required",
      });
      return;
    }

    const site = await createSite(req.user.id, siteData);

    res.status(201).json({
      success: true,
      data: site,
      message: "Site created successfully",
    });
  } catch (error) {
    console.error("Error creating site:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create site",
    });
  }
};

/**
 * Get site details
 */
export const getSiteController = async (
  req: AuthenticatedRequest,
  res: any
) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { site_id } = req.params;
    const site = await getSiteByIdForUser(site_id, req.user.id);

    if (!site) {
      res.status(404).json({
        success: false,
        error: "Site not found or access denied",
      });
      return;
    }

    res.json({
      success: true,
      data: site,
    });
  } catch (error) {
    console.error("Error getting site:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get site details",
    });
  }
};

/**
 * Update site
 */
export const updateSiteController = async (
  req: AuthenticatedRequest,
  res: any
) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { site_id } = req.params;
    const updateData: UpdateSiteRequest = req.body;

    const updatedSite = await updateSite(site_id, req.user.id, updateData);

    res.json({
      success: true,
      data: updatedSite,
      message: "Site updated successfully",
    });
  } catch (error) {
    console.error("Error updating site:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update site",
    });
  }
};

/**
 * Delete site
 */
export const deleteSiteController = async (
  req: AuthenticatedRequest,
  res: any
) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { site_id } = req.params;
    await deleteSite(site_id, req.user.id);

    res.json({
      success: true,
      message: "Site deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting site:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete site",
    });
  }
};

/**
 * Get site statistics
 */
export const getSiteStatsController = async (
  req: AuthenticatedRequest,
  res: any
) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { site_id } = req.params;
    const siteStats = await getSiteStatistics(site_id, req.user.id);

    res.json({
      success: true,
      data: siteStats,
    });
  } catch (error) {
    console.error("Error getting site stats:", error);
    res.status(400).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get site statistics",
    });
  }
};

/**
 * Search posts within a site
 */
export const searchSiteController = async (
  req: AuthenticatedRequest,
  res: any
) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { site_id } = req.params;
    const { query, topK }: { query: string; topK?: number } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        error: "Query parameter is required",
      });
      return;
    }

    // Verify user owns the site
    const site = await getSiteByIdForUser(site_id, req.user.id);
    if (!site) {
      res.status(404).json({
        success: false,
        error: "Site not found or access denied",
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
      res.json({
        success: true,
        data: {
          results: [],
          site_id: site_id,
          query: query,
          totalPosts: 0,
          totalChunks: 0,
        },
        message: "No matching content found for your query.",
      });
      return;
    }

    res.json({
      success: true,
      data: {
        results: similarPosts,
        site_id: site_id,
        query: query,
        totalPosts: similarPosts.length,
        totalChunks: similarPosts.reduce(
          (sum: number, post: any) => sum + post.totalChunks,
          0
        ),
      },
    });
  } catch (error) {
    console.error("Error searching site:", error);

    if (error instanceof Error) {
      if (error.message.includes("Not Found")) {
        res.status(404).json({
          success: false,
          error:
            "Post content has not been embedded yet. Please embed posts first.",
          code: "POSTS_NOT_EMBEDDED",
        });
      } else {
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to search site",
      });
    }
  }
};

/**
 * Embed content for a site
 */
export const embedSiteController = async (
  req: AuthenticatedRequest,
  res: any
) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { site_id } = req.params;
    const batchData: EmbedBatchRequest = {
      ...req.body,
      site_id: site_id,
    };

    // Verify user owns the site
    const site = await getSiteByIdForUser(site_id, req.user.id);
    if (!site) {
      res.status(404).json({
        success: false,
        error: "Site not found or access denied",
      });
      return;
    }

    // Validate the batch request structure
    if (!batchData.posts || !Array.isArray(batchData.posts)) {
      res.status(400).json({
        success: false,
        error:
          "Invalid request format. Expected 'posts' array in request body.",
      });
      return;
    }

    // Update site embedding status to in_progress
    await updateSiteEmbeddingStatus(site_id, "in_progress");

    // Validate chunked posts before processing
    const validation = validateChunkedPosts(batchData.posts);
    if (!validation.isValid) {
      await updateSiteEmbeddingStatus(site_id, "failed");
      res.status(400).json({
        success: false,
        error: "Incomplete chunked posts detected",
        details: validation.missingChunks,
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

    // Calculate overall statistics
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

    // Send immediate response to prevent timeout
    const processingStartTime = new Date().toISOString();

    res.json({
      success: true,
      message: `Embedding process started for ${textChunks.length} chunks. Processing will continue in background.`,
      data: {
        status: "processing",
        processingStarted: processingStartTime,
        siteId: site_id,
        siteName: site.name,
        siteUrl: site.url,
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
      },
    });

    // Continue processing in background
    setImmediate(async () => {
      try {
        console.log(
          `Starting embedding process for ${textChunks.length} chunks`
        );
        await upsertSiteChunks(site_id, textChunks);

        // Update site status to completed
        await updateSiteEmbeddingStatus(
          site_id,
          "completed",
          postsWithStats.length,
          textChunks.length
        );

        console.log(`Embedding process completed for site ${site_id}`);
      } catch (error) {
        console.error(
          `Background embedding failed for site ${site_id}:`,
          error
        );
        await updateSiteEmbeddingStatus(site_id, "failed");
      }
    });
  } catch (error) {
    console.error("Error in embed site controller:", error);

    // Update site status to failed
    if (req.params.site_id) {
      await updateSiteEmbeddingStatus(req.params.site_id, "failed");
    }

    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to start embedding process",
    });
  }
};
