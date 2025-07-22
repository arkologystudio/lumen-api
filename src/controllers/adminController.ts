import { RequestHandler } from "express";
import { getAllUsers } from "../services/userService";
import { getAllSites, searchSites } from "../services/siteService";
import { listSiteCollections } from "../services/multiSiteVectorStore";
import { prisma } from "../config/database";
import {
  getAllProducts,
  initializeDefaultProducts,
  initializeDefaultPricingTiers,
  initializeCompleteSystem,
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
 * Initialize default products only (admin only)
 * This will create the default products if they don't exist, but won't overwrite existing ones
 */
export const initializeProductsController: RequestHandler = async (
  req,
  res
) => {
  try {
    const productsBefore = await getAllProducts();
    
    await initializeDefaultProducts();
    
    const productsAfter = await getAllProducts();
    const newProductsCount = productsAfter.length - productsBefore.length;

    res.json({
      success: true,
      data: {
        products_before: productsBefore.length,
        products_after: productsAfter.length,
        new_products_created: newProductsCount,
        products: productsAfter
      },
      message: `Product initialization completed. ${newProductsCount} new products created.`,
    });
  } catch (error) {
    console.error("Error initializing default products:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initialize default products",
    });
  }
};

/**
 * Initialize pricing tiers only (admin only)
 */
export const initializePricingTiersController: RequestHandler = async (
  req,
  res
) => {
  try {
    const tiersBefore = await prisma.pricingTier.count();
    
    await initializeDefaultPricingTiers();
    
    const tiersAfter = await prisma.pricingTier.count();
    const newTiersCount = tiersAfter - tiersBefore;

    const allTiers = await prisma.pricingTier.findMany({
      include: { product: true },
      orderBy: { sort_order: 'asc' }
    });

    res.json({
      success: true,
      data: {
        tiers_before: tiersBefore,
        tiers_after: tiersAfter,
        new_tiers_created: newTiersCount,
        pricing_tiers: allTiers.map((tier: any) => ({
          id: tier.id,
          tier_name: tier.tier_name,
          display_name: tier.display_name,
          monthly_price: tier.monthly_price,
          annual_price: tier.annual_price,
          max_queries: tier.max_queries,
          max_sites: tier.max_sites,
          agent_api_access: tier.agent_api_access,
          product_name: tier.product.name
        }))
      },
      message: `Pricing tier initialization completed. ${newTiersCount} new tiers created.`,
    });
  } catch (error) {
    console.error("Error initializing pricing tiers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initialize pricing tiers",
    });
  }
};

/**
 * Initialize complete licensing system (admin only)
 * This creates both products and pricing tiers in the correct order
 */
export const initializeCompleteSystemController: RequestHandler = async (
  req,
  res
) => {
  try {
    const productsBefore = await getAllProducts();
    const tiersBefore = await prisma.pricingTier.count();
    
    await initializeCompleteSystem();
    
    const productsAfter = await getAllProducts();
    const tiersAfter = await prisma.pricingTier.count();

    const allTiers = await prisma.pricingTier.findMany({
      include: { product: true },
      orderBy: { sort_order: 'asc' }
    });

    res.json({
      success: true,
      data: {
        products: {
          before: productsBefore.length,
          after: productsAfter.length,
          new_created: productsAfter.length - productsBefore.length
        },
        pricing_tiers: {
          before: tiersBefore,
          after: tiersAfter,
          new_created: tiersAfter - tiersBefore,
          tiers: allTiers.map((tier: any) => ({
            tier_name: tier.tier_name,
            display_name: tier.display_name,
            monthly_price: tier.monthly_price,
            agent_api_access: tier.agent_api_access,
            product_name: tier.product.name
          }))
        }
      },
      message: "Complete licensing system initialized successfully!",
    });
  } catch (error) {
    console.error("Error initializing complete system:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initialize complete licensing system",
    });
  }
};

/**
 * Get products status (admin only)
 */
export const getProductsStatusController: RequestHandler = async (
  req,
  res
) => {
  try {
    const products = await getAllProducts();

    res.json({
      success: true,
      data: {
        total_products: products.length,
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          category: p.category,
          is_active: p.is_active,
          is_beta: p.is_beta,
          base_price: p.base_price,
          created_at: p.created_at
        }))
      },
      message: `Found ${products.length} products in database`,
    });
  } catch (error) {
    console.error("Error getting products status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get products status",
    });
  }
};

/**
 * Cleanup and reinitialize ecosystem products (admin only)
 * This is a one-time fix for cleaning up inconsistent data
 */
export const cleanupEcosystemProductsController: RequestHandler = async (
  req,
  res
) => {
  try {
    await cleanupAndReinitializeProducts();

    const products = await getAllProducts();

    res.json({
      success: true,
      data: {
        products_after_cleanup: products.length,
        products: products.map((p: any) => ({
          name: p.name,
          slug: p.slug,
          is_active: p.is_active,
        })),
      },
      message: "Products cleaned up and reinitialized successfully!",
    });
  } catch (error) {
    console.error("Error during cleanup and reinitialization:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cleanup and reinitialize products",
    });
  }
};
