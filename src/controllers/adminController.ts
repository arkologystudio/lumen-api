import { RequestHandler } from "express";
import { getAllUsers } from "../services/userService";
import { getAllSites, searchSites } from "../services/siteService";
import { listSiteCollections } from "../services/multiSiteVectorStore";
import { prisma } from "../config/database";
import {
  getAllProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  initializeDefaultProducts,
  initializeDefaultPricingTiers,
  initializeCompleteSystem,
  cleanupAndReinitializeProducts,
} from "../services/ecosystemProductService";
import {
  checkInitializationStatus,
  initializeProductsIfNeeded,
  resetDatabase,
  resetAndReinitialize,
  forceReinitializeProducts,
  getDatabaseStats
} from "../services/databaseManagement";

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
 * Initialize default products only (admin only) - LEGACY
 * This will create the default products if they don't exist, but won't overwrite existing ones
 * @deprecated Use initializeProductsController instead
 */
export const legacyInitializeProductsController: RequestHandler = async (
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

/**
 * Get all ecosystem products (admin only) - including inactive
 */
export const getAdminEcosystemProductsController: RequestHandler = async (req, res) => {
  try {
    const { include_inactive } = req.query;
    
    // Get all products or just active ones based on query parameter
    const products = await prisma.product.findMany({
      where: include_inactive === 'true' ? {} : { is_active: true },
      include: {
        _count: {
          select: {
            site_products: true,
            licenses: true,
            downloads: true,
          },
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const productsWithStats = products.map((product: any) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      category: product.category,
      version: product.version,
      is_active: product.is_active,
      is_beta: product.is_beta,
      base_price: product.base_price ?? undefined,
      usage_based: product.usage_based,
      features: (product.features as string[]) || [],
      limits: (product.limits as Record<string, any>) || {},
      extended_documentation: product.extended_documentation || "",
      created_at: product.created_at.toISOString(),
      updated_at: product.updated_at.toISOString(),
      stats: {
        sites_using: product._count.site_products,
        total_licenses: product._count.licenses,
        total_downloads: product._count.downloads,
      },
    }));

    res.json({
      success: true,
      products: productsWithStats,
      total: productsWithStats.length,
    });
  } catch (error) {
    console.error("Error getting admin ecosystem products:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get ecosystem products",
    });
  }
};

/**
 * Create a new ecosystem product (admin only)
 */
export const createAdminEcosystemProductController: RequestHandler = async (req, res) => {
  try {
    const productData = req.body;

    if (!productData.name || !productData.slug || !productData.description || !productData.category) {
      res.status(400).json({
        success: false,
        error: "Name, slug, description, and category are required",
      });
      return;
    }

    // Check if slug already exists
    const existingProduct = await getProductBySlug(productData.slug);
    if (existingProduct) {
      res.status(409).json({
        success: false,
        error: "Product with this slug already exists",
      });
      return;
    }

    const newProduct = await createProduct(productData);

    res.status(201).json({
      success: true,
      product: newProduct,
      message: "Ecosystem product created successfully",
    });
  } catch (error) {
    console.error("Error creating ecosystem product:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create ecosystem product",
    });
  }
};

/**
 * Update an ecosystem product (admin only)
 */
export const updateAdminEcosystemProductController: RequestHandler = async (req, res) => {
  try {
    const { slug } = req.params;
    const updateData = req.body;

    // Check if product exists
    const existingProduct = await getProductBySlug(slug);
    if (!existingProduct) {
      res.status(404).json({
        success: false,
        error: "Product not found",
      });
      return;
    }

    const updatedProduct = await updateProduct(slug, updateData);

    res.json({
      success: true,
      product: updatedProduct,
      message: "Ecosystem product updated successfully",
    });
  } catch (error) {
    console.error("Error updating ecosystem product:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update ecosystem product",
    });
  }
};

/**
 * Delete an ecosystem product (admin only)
 */
export const deleteAdminEcosystemProductController: RequestHandler = async (req, res) => {
  try {
    const { slug } = req.params;

    // Check if product exists
    const existingProduct = await getProductBySlug(slug);
    if (!existingProduct) {
      res.status(404).json({
        success: false,
        error: "Product not found",
      });
      return;
    }

    // Check if product is in use
    const sitesUsingProduct = await prisma.siteProduct.count({
      where: { product_id: existingProduct.id },
    });

    if (sitesUsingProduct > 0) {
      res.status(409).json({
        success: false,
        message: "Cannot delete product that is in use by sites",
        sites_using_product: sitesUsingProduct,
      });
      return;
    }

    await deleteProduct(slug);

    res.json({
      success: true,
      message: "Ecosystem product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting ecosystem product:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete ecosystem product",
    });
  }
};

/**
 * Get database initialization status
 */
export const getDatabaseStatusController: RequestHandler = async (req, res) => {
  try {
    const status = await checkInitializationStatus();
    const stats = await getDatabaseStats();
    
    res.json({
      success: true,
      data: {
        initialization: status,
        statistics: stats
      }
    });
  } catch (error) {
    console.error("Error getting database status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get database status"
    });
  }
};

/**
 * Initialize products if needed
 */
export const initializeProductsController: RequestHandler = async (req, res) => {
  try {
    const wasInitialized = await initializeProductsIfNeeded();
    
    res.json({
      success: true,
      data: {
        initialized: wasInitialized,
        message: wasInitialized 
          ? "Products initialized successfully from config" 
          : "Products already initialized"
      }
    });
  } catch (error) {
    console.error("Error initializing products:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initialize products"
    });
  }
};

/**
 * Reset database (requires confirmation)
 */
export const resetDatabaseController: RequestHandler = async (req, res) => {
  try {
    const { confirm, skip_confirmation } = req.body;
    
    if (!skip_confirmation && confirm !== "RESET_DATABASE") {
      return res.status(400).json({
        success: false,
        error: "Confirmation required. Send { confirm: 'RESET_DATABASE' } to proceed"
      });
    }
    
    await resetDatabase(true); // Skip CLI confirmation since we have API confirmation
    
    res.json({
      success: true,
      message: "Database reset complete. Run initialize endpoint to add products."
    });
  } catch (error) {
    console.error("Error resetting database:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reset database"
    });
  }
};

/**
 * Reset and reinitialize database
 */
export const resetAndReinitializeController: RequestHandler = async (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== "RESET_AND_REINITIALIZE") {
      return res.status(400).json({
        success: false,
        error: "Confirmation required. Send { confirm: 'RESET_AND_REINITIALIZE' } to proceed"
      });
    }
    
    await resetAndReinitialize(true);
    const stats = await getDatabaseStats();
    
    res.json({
      success: true,
      message: "Database reset and reinitialized successfully",
      data: {
        statistics: stats
      }
    });
  } catch (error) {
    console.error("Error resetting and reinitializing:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reset and reinitialize database"
    });
  }
};

/**
 * Force reinitialize products (overwrites existing)
 */
export const forceReinitializeProductsController: RequestHandler = async (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== "FORCE_REINITIALIZE") {
      return res.status(400).json({
        success: false,
        error: "Confirmation required. Send { confirm: 'FORCE_REINITIALIZE' } to proceed"
      });
    }
    
    await forceReinitializeProducts();
    const products = await getAllProducts();
    
    res.json({
      success: true,
      message: "Products force reinitialized successfully",
      data: {
        product_count: products.length,
        products: products.map((p: any) => ({
          name: p.name,
          slug: p.slug,
          version: p.version
        }))
      }
    });
  } catch (error) {
    console.error("Error force reinitializing products:", error);
    res.status(500).json({
      success: false,
      error: "Failed to force reinitialize products"
    });
  }
};
