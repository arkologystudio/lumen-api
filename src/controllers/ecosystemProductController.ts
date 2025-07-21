/**
 * Ecosystem Product Controller
 * Handles API endpoints for managing ecosystem products and site registrations
 */

import { Request, Response } from "express";
import {
  getAllEcosystemProducts,
  getEcosystemProductsByCategory,
  getEcosystemProductBySlug,
  registerSiteProduct,
  getSiteProducts,
  updateSiteProduct,
  unregisterSiteProduct,
  siteHasProduct,
  trackProductUsage,
} from "../services/ecosystemProductService";
import {
  RegisterSiteProductRequest,
  UpdateSiteProductRequest,
  SiteProductsResponse,
} from "../types";
import { PrismaClient } from "@prisma/client";
import {
  logActivityWithRequest,
  ACTIVITY_TYPES,
} from "../services/activityLogService";

const prisma = new PrismaClient();

/**
 * GET /api/ecosystem/products
 * Get all available ecosystem products
 */
export const getEcosystemProductsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category } = req.query;

    let products;
    if (category && typeof category === "string") {
      products = await getEcosystemProductsByCategory(category);
    } else {
      products = await getAllEcosystemProducts();
    }

    res.json({
      success: true,
      products,
      total: products.length,
    });
  } catch (error) {
    console.error("Error getting ecosystem products:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get ecosystem products",
    });
  }
};

/**
 * GET /api/ecosystem/products/:slug
 * Get a specific ecosystem product by slug
 */
export const getEcosystemProductController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { slug } = req.params;

    const product = await getEcosystemProductBySlug(slug);

    if (!product) {
      res.status(404).json({
        success: false,
        error: "Product not found",
      });
      return;
    }

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Error getting ecosystem product:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get ecosystem product",
    });
  }
};

/**
 * GET /api/sites/:siteId/products
 * Get all products registered for a site
 */
export const getSiteProductsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { siteId } = req.params;
    const { enabled_only } = req.query;

    let products = await getSiteProducts(siteId);

    // Filter to enabled only if requested
    if (enabled_only === "true") {
      products = products.filter((p) => p.is_enabled);
    }

    const response: SiteProductsResponse = {
      products: products as any, // Type assertion for the response
      total: products.length,
    };

    res.json({
      success: true,
      ...response,
    });
  } catch (error) {
    console.error("Error getting site products:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get site products",
    });
  }
};

/**
 * POST /api/sites/:siteId/products
 * Register a product for a site
 */
export const registerSiteProductController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { siteId } = req.params;
    const request: RegisterSiteProductRequest = req.body;

    // Validate request
    if (!request.product_slug) {
      res.status(400).json({
        success: false,
        error: "product_slug is required",
      });
      return;
    }

    const siteProduct = await registerSiteProduct(siteId, request);

    // Log product registration activity
    try {
      const userId = (req as any).user?.id || (req as any).auth?.jti;

      if (userId && siteProduct.product) {
        await logActivityWithRequest(
          req,
          userId,
          ACTIVITY_TYPES.PRODUCT_REGISTERED,
          `Product registered: ${siteProduct.product.name}`,
          {
            description: `Registered ${siteProduct.product.name} for site`,
            siteId: siteId,
            targetId: siteProduct.product.id,
            targetType: "ecosystem_product",
            metadata: {
              product_name: siteProduct.product.name,
              product_slug: siteProduct.product.slug,
              product_category: siteProduct.product.category,
              site_id: siteId,
            },
          }
        );
      }
    } catch (activityError) {
      console.error(
        "Failed to log product registration activity:",
        activityError
      );
    }

    res.status(201).json({
      success: true,
      site_product: siteProduct,
      message: "Product registered successfully",
    });
  } catch (error: any) {
    console.error("Error registering site product:", error);

    if (error.message?.includes("not found")) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
    } else if (
      error.message?.includes("already registered") ||
      error.message?.includes("not active")
    ) {
      res.status(409).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to register product",
      });
    }
  }
};

/**
 * PUT /api/sites/:siteId/products/:productSlug
 * Update site product configuration
 */
export const updateSiteProductController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { siteId, productSlug } = req.params;
    const updates: UpdateSiteProductRequest = req.body;

    const siteProduct = await updateSiteProduct(siteId, productSlug, updates);

    res.json({
      success: true,
      site_product: siteProduct,
      message: "Product updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating site product:", error);

    if (error.message?.includes("not found")) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to update product",
      });
    }
  }
};

/**
 * DELETE /api/sites/:siteId/products/:productSlug
 * Unregister a product from a site
 */
export const unregisterSiteProductController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { siteId, productSlug } = req.params;

    await unregisterSiteProduct(siteId, productSlug);

    // Log product unregistration activity
    try {
      const userId = (req as any).user?.id || (req as any).auth?.jti;

      if (userId) {
        await logActivityWithRequest(
          req,
          userId,
          ACTIVITY_TYPES.PRODUCT_UNREGISTERED,
          `Product unregistered: ${productSlug}`,
          {
            description: `Unregistered product ${productSlug} from site`,
            siteId: siteId,
            targetId: productSlug,
            targetType: "ecosystem_product",
            metadata: {
              product_slug: productSlug,
              site_id: siteId,
            },
          }
        );
      }
    } catch (activityError) {
      console.error(
        "Failed to log product unregistration activity:",
        activityError
      );
    }

    res.json({
      success: true,
      message: "Product unregistered successfully",
    });
  } catch (error: any) {
    console.error("Error unregistering site product:", error);

    if (error.message?.includes("not found")) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to unregister product",
      });
    }
  }
};

/**
 * GET /api/sites/:siteId/products/:productSlug/status
 * Check if a site has a product registered and enabled
 */
export const checkSiteProductController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { siteId, productSlug } = req.params;

    const hasProduct = await siteHasProduct(siteId, productSlug);

    res.json({
      success: true,
      has_product: hasProduct,
      enabled: hasProduct,
    });
  } catch (error) {
    console.error("Error checking site product:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check product status",
    });
  }
};

/**
 * POST /api/sites/:siteId/products/:productSlug/track-usage
 * Track usage of a product (internal endpoint)
 */
export const trackProductUsageController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { siteId, productSlug } = req.params;

    await trackProductUsage(siteId, productSlug);

    res.json({
      success: true,
      message: "Usage tracked",
    });
  } catch (error) {
    console.error("Error tracking product usage:", error);
    // Don't return error for usage tracking
    res.json({
      success: true,
      message: "Usage tracking attempted",
    });
  }
};

/**
 * GET /api/ecosystem/categories
 * Get available product categories
 */
export const getProductCategoriesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const products = await getAllEcosystemProducts();
    const categories = [...new Set(products.map((p) => p.category))].sort();

    res.json({
      success: true,
      categories,
      total: categories.length,
    });
  } catch (error) {
    console.error("Error getting product categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get product categories",
    });
  }
};

// ==================== ADMIN ONLY CONTROLLERS ====================

/**
 * POST /api/admin/ecosystem/products
 * Create a new ecosystem product (admin only)
 */
export const createEcosystemProductController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      slug,
      description,
      category,
      version = "1.0",
      is_active = true,
      is_beta = false,
      base_price,
      usage_based = false,
      features = [],
      limits = {},
    } = req.body;

    // Validate required fields
    if (!name || !slug || !description || !category) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: name, slug, description, category",
      });
      return;
    }

    // Check if slug already exists
    const existingProduct = await prisma.ecosystemProduct.findUnique({
      where: { slug },
    });

    if (existingProduct) {
      res.status(409).json({
        success: false,
        error: "A product with this slug already exists",
      });
      return;
    }

    // Create the product
    const product = await prisma.ecosystemProduct.create({
      data: {
        name,
        slug,
        description,
        category,
        version,
        is_active,
        is_beta,
        base_price,
        usage_based,
        features,
        limits,
      },
    });

    res.status(201).json({
      success: true,
      product: {
        ...product,
        features: (product.features as string[]) || [],
        limits: (product.limits as Record<string, any>) || {},
      },
      message: "Ecosystem product created successfully",
    });
  } catch (error) {
    console.error("Error creating ecosystem product:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create ecosystem product",
    });
  }
};

/**
 * PUT /api/admin/ecosystem/products/:slug
 * Update an ecosystem product (admin only)
 */
export const updateEcosystemProductController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { slug } = req.params;
    const updateData = req.body;

    // Remove id and created_at from update data if present
    delete updateData.id;
    delete updateData.created_at;

    // Update the product
    const product = await prisma.ecosystemProduct.update({
      where: { slug },
      data: updateData,
    });

    res.json({
      success: true,
      product: {
        ...product,
        features: (product.features as string[]) || [],
        limits: (product.limits as Record<string, any>) || {},
      },
      message: "Ecosystem product updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating ecosystem product:", error);

    if (error.code === "P2025") {
      res.status(404).json({
        success: false,
        error: "Product not found",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to update ecosystem product",
      });
    }
  }
};

/**
 * DELETE /api/admin/ecosystem/products/:slug
 * Delete an ecosystem product (admin only)
 */
export const deleteEcosystemProductController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { slug } = req.params;

    // Check if product exists
    const product = await prisma.ecosystemProduct.findUnique({
      where: { slug },
      include: {
        site_products: true,
      },
    });

    if (!product) {
      res.status(404).json({
        success: false,
        error: "Product not found",
      });
      return;
    }

    // Check if product is being used by any sites
    if (product.site_products.length > 0) {
      res.status(409).json({
        success: false,
        error:
          "Cannot delete product that is registered by sites. Deactivate it instead.",
        sites_using_product: product.site_products.length,
      });
      return;
    }

    // Delete the product
    await prisma.ecosystemProduct.delete({
      where: { slug },
    });

    res.json({
      success: true,
      message: "Ecosystem product deleted successfully",
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
 * GET /api/admin/ecosystem/products
 * Get all ecosystem products including inactive ones (admin only)
 */
export const getAdminEcosystemProductsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { include_inactive } = req.query;

    const whereClause = include_inactive === "true" ? {} : { is_active: true };

    const products = await prisma.ecosystemProduct.findMany({
      where: whereClause,
      include: {
        site_products: {
          select: {
            id: true,
            site_id: true,
            is_enabled: true,
          },
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const productsWithStats = products.map((product: any) => ({
      ...product,
      features: (product.features as string[]) || [],
      limits: (product.limits as Record<string, any>) || {},
      total_site_registrations: product.site_products.length,
      active_site_registrations: product.site_products.filter(
        (sp: any) => sp.is_enabled
      ).length,
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
