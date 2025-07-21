import { RequestHandler } from "express";
import { getAllUsers } from "../services/userService";
import { getAllSites, searchSites } from "../services/siteService";
import { listSiteCollections } from "../services/multiSiteVectorStore";
import {
  debugAllEcosystemProducts,
  deleteEcosystemProduct,
  cleanupAndReinitializeProducts,
} from "../services/ecosystemProductService";

/**
 * Get all users (admin only)
 */
export const getAllUsersController: RequestHandler = async (req, res) => {
  try {
    const users = await getAllUsers();

    res.json({
      success: true,
      data: users,
      message: `Found ${users.length} users`,
    });
  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get users",
    });
  }
};

/**
 * Get all sites (admin only)
 */
export const getAllSitesController: RequestHandler = async (req, res) => {
  try {
    const { query, user_id } = req.query;

    const sites = await searchSites(
      typeof query === "string" ? query : undefined,
      typeof user_id === "string" ? user_id : undefined
    );

    res.json({
      success: true,
      data: sites,
      message: `Found ${sites.length} sites`,
    });
  } catch (error) {
    console.error("Error getting all sites:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get sites",
    });
  }
};

/**
 * Get all vector collections (admin only)
 */
export const getAllCollectionsController: RequestHandler = async (req, res) => {
  try {
    const collections = await listSiteCollections();

    res.json({
      success: true,
      data: collections,
      message: `Found ${collections.length} collections`,
    });
  } catch (error) {
    console.error("Error getting all collections:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get collections",
    });
  }
};

/**
 * Get system statistics (admin only)
 */
export const getSystemStatsController: RequestHandler = async (req, res) => {
  try {
    const [users, sites, collections] = await Promise.all([
      getAllUsers(),
      getAllSites(),
      listSiteCollections(),
    ]);

    const activeUsers = users.filter((user) => user.is_active).length;
    const activeSites = sites.filter((site) => site.is_active).length;
    const completedEmbeddings = sites.filter(
      (site) => site.embedding_status === "completed"
    ).length;

    const totalPosts = sites.reduce((sum, site) => sum + site.post_count, 0);
    const totalChunks = sites.reduce((sum, site) => sum + site.chunk_count, 0);

    res.json({
      success: true,
      data: {
        users: {
          total: users.length,
          active: activeUsers,
          inactive: users.length - activeUsers,
        },
        sites: {
          total: sites.length,
          active: activeSites,
          inactive: sites.length - activeSites,
          with_embeddings: completedEmbeddings,
          without_embeddings: sites.length - completedEmbeddings,
        },
        content: {
          total_posts: totalPosts,
          total_chunks: totalChunks,
          average_chunks_per_site:
            activeSites > 0 ? Math.round(totalChunks / activeSites) : 0,
        },
        collections: {
          total: collections.length,
        },
      },
    });
  } catch (error) {
    console.error("Error getting system stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get system statistics",
    });
  }
};

/**
 * Debug all ecosystem products (admin only)
 */
export const debugEcosystemProductsController: RequestHandler = async (
  req,
  res
) => {
  try {
    const products = await debugAllEcosystemProducts();

    res.json({
      success: true,
      data: products,
      message: `Found ${products.length} ecosystem products (including inactive)`,
    });
  } catch (error) {
    console.error("Error debugging ecosystem products:", error);
    res.status(500).json({
      success: false,
      error: "Failed to debug ecosystem products",
    });
  }
};

/**
 * Delete ecosystem product (admin only)
 */
export const deleteEcosystemProductController: RequestHandler = async (
  req,
  res
) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: "Product ID or slug is required",
      });
    }

    await deleteEcosystemProduct(identifier);

    res.json({
      success: true,
      message: `Ecosystem product deleted: ${identifier}`,
    });
  } catch (error) {
    console.error("Error deleting ecosystem product:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete ecosystem product",
    });
  }
};

/**
 * Cleanup and reinitialize ecosystem products (admin only)
 */
export const cleanupEcosystemProductsController: RequestHandler = async (
  req,
  res
) => {
  try {
    await cleanupAndReinitializeProducts();

    res.json({
      success: true,
      message: "Ecosystem products cleaned up and reinitialized successfully",
    });
  } catch (error) {
    console.error("Error cleaning up ecosystem products:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cleanup ecosystem products",
    });
  }
};
