/**
 * Ecosystem Product Service
 * Manages SaaS products offered in the ecosystem and site registrations
 */

import { PrismaClient } from "@prisma/client";
import {
  EcosystemProduct,
  SiteProduct,
  RegisterSiteProductRequest,
  UpdateSiteProductRequest,
} from "../types";

const prisma = new PrismaClient();

// Predefined ecosystem products
const ECOSYSTEM_PRODUCTS = [
  {
    name: "Neural Search - Knowledge",
    slug: "neural-search-knowledge",
    description:
      "AI-powered semantic search for knowledge bases, documentation, and blog content. Transform how users discover information.",
    category: "search",
    version: "1.0",
    is_active: true,
    is_beta: false,
    base_price: 29.0,
    usage_based: true,
    features: [
      "Semantic search across all content",
      "Multi-language support",
      "Real-time indexing",
      "Relevance scoring",
      "Search analytics",
      "API access",
    ],
    limits: {
      free: { sites: 1, searches_per_month: 1000, chunks: 5000 },
      pro: { sites: 10, searches_per_month: 50000, chunks: 100000 },
      enterprise: { sites: -1, searches_per_month: -1, chunks: -1 },
    },
  },
  {
    name: "Neural Search - Product",
    slug: "neural-search-product",
    description:
      "Advanced AI search for e-commerce and product catalogs. Enable customers to find products using natural language.",
    category: "search",
    version: "1.0",
    is_active: true,
    is_beta: false,
    base_price: 49.0,
    usage_based: true,
    features: [
      "Product semantic search",
      "Attribute-based filtering",
      "Price range queries",
      "Brand and category search",
      "Inventory integration",
      "Search recommendations",
      "Purchase intent analysis",
    ],
    limits: {
      free: { sites: 1, searches_per_month: 500, products: 1000 },
      pro: { sites: 5, searches_per_month: 25000, products: 50000 },
      enterprise: { sites: -1, searches_per_month: -1, products: -1 },
    },
  },
  {
    name: "AI Readiness Analysis",
    slug: "ai-readiness-analysis",
    description:
      "Comprehensive analysis of your content and site structure for AI optimization. Get actionable insights to improve search relevance.",
    category: "analysis",
    version: "1.0",
    is_active: true,
    is_beta: true,
    base_price: 19.0,
    usage_based: false,
    features: [
      "Content quality analysis",
      "SEO optimization insights",
      "Semantic structure review",
      "Search performance metrics",
      "AI-readiness scoring",
      "Improvement recommendations",
      "Competitive analysis",
    ],
    limits: {
      free: { sites: 1, analyses_per_month: 2 },
      pro: { sites: 10, analyses_per_month: 20 },
      enterprise: { sites: -1, analyses_per_month: -1 },
    },
  },
];

/**
 * Initialize ecosystem products (auto-populate on startup)
 */
export const initializeEcosystemProducts = async (): Promise<void> => {
  console.log("🔧 Initializing ecosystem products...");

  try {
    for (const productData of ECOSYSTEM_PRODUCTS) {
      const existingProduct = await prisma.ecosystemProduct.findUnique({
        where: { slug: productData.slug },
      });

      if (!existingProduct) {
        await prisma.ecosystemProduct.create({
          data: {
            ...productData,
            features: productData.features,
            limits: productData.limits,
          },
        });
        console.log(`✅ Created ecosystem product: ${productData.name}`);
      } else {
        // Update existing product with latest data
        await prisma.ecosystemProduct.update({
          where: { slug: productData.slug },
          data: {
            ...productData,
            features: productData.features,
            limits: productData.limits,
          },
        });
        console.log(`🔄 Updated ecosystem product: ${productData.name}`);
      }
    }

    console.log("✅ Ecosystem products initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize ecosystem products:", error);
    throw error;
  }
};

/**
 * Get all active ecosystem products
 */
export const getAllEcosystemProducts = async (): Promise<
  EcosystemProduct[]
> => {
  try {
    const products = await prisma.ecosystemProduct.findMany({
      where: { is_active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return products.map((product: any) => ({
      ...product,
      features: (product.features as string[]) || [],
      limits: (product.limits as Record<string, any>) || {},
    }));
  } catch (error) {
    console.error("Error getting ecosystem products:", error);
    throw error;
  }
};

/**
 * Get ecosystem products by category
 */
export const getEcosystemProductsByCategory = async (
  category: string
): Promise<EcosystemProduct[]> => {
  try {
    const products = await prisma.ecosystemProduct.findMany({
      where: {
        category,
        is_active: true,
      },
      orderBy: { name: "asc" },
    });

    return products.map((product: any) => ({
      ...product,
      features: (product.features as string[]) || [],
      limits: (product.limits as Record<string, any>) || {},
    }));
  } catch (error) {
    console.error(`Error getting products for category ${category}:`, error);
    throw error;
  }
};

/**
 * Get single ecosystem product by slug
 */
export const getEcosystemProductBySlug = async (
  slug: string
): Promise<EcosystemProduct | null> => {
  try {
    const product = await prisma.ecosystemProduct.findUnique({
      where: { slug },
    });

    if (!product) return null;

    return {
      ...product,
      features: (product.features as string[]) || [],
      limits: (product.limits as Record<string, any>) || {},
    };
  } catch (error) {
    console.error(`Error getting product by slug ${slug}:`, error);
    throw error;
  }
};

/**
 * Register a product for a site
 */
export const registerSiteProduct = async (
  siteId: string,
  request: RegisterSiteProductRequest
): Promise<SiteProduct> => {
  try {
    // Find the ecosystem product
    const ecosystemProduct = await prisma.ecosystemProduct.findUnique({
      where: { slug: request.product_slug },
    });

    if (!ecosystemProduct) {
      throw new Error(`Product not found: ${request.product_slug}`);
    }

    if (!ecosystemProduct.is_active) {
      throw new Error(`Product is not active: ${request.product_slug}`);
    }

    // Check if already registered
    const existingRegistration = await prisma.siteProduct.findUnique({
      where: {
        site_id_product_id: {
          site_id: siteId,
          product_id: ecosystemProduct.id,
        },
      },
    });

    if (existingRegistration) {
      throw new Error(
        `Product already registered for this site: ${request.product_slug}`
      );
    }

    // Create the registration
    const siteProduct = await prisma.siteProduct.create({
      data: {
        site_id: siteId,
        product_id: ecosystemProduct.id,
        config: request.config || {},
        is_enabled: true,
      },
      include: {
        product: true,
      },
    });

    return {
      ...siteProduct,
      product: {
        ...siteProduct.product,
        features: (siteProduct.product.features as string[]) || [],
        limits: (siteProduct.product.limits as Record<string, any>) || {},
      },
    };
  } catch (error) {
    console.error("Error registering site product:", error);
    throw error;
  }
};

/**
 * Get all products registered for a site
 */
export const getSiteProducts = async (
  siteId: string
): Promise<SiteProduct[]> => {
  try {
    const siteProducts = await prisma.siteProduct.findMany({
      where: { site_id: siteId },
      include: {
        product: true,
      },
      orderBy: [{ product: { category: "asc" } }, { product: { name: "asc" } }],
    });

    return siteProducts.map((sp: any) => ({
      ...sp,
      config: (sp.config as Record<string, any>) || {},
      usage_limits: (sp.usage_limits as Record<string, any>) || {},
      product: {
        ...sp.product,
        features: (sp.product.features as string[]) || [],
        limits: (sp.product.limits as Record<string, any>) || {},
      },
    }));
  } catch (error) {
    console.error(`Error getting products for site ${siteId}:`, error);
    throw error;
  }
};

/**
 * Update site product configuration
 */
export const updateSiteProduct = async (
  siteId: string,
  productSlug: string,
  updates: UpdateSiteProductRequest
): Promise<SiteProduct> => {
  try {
    // Find the ecosystem product
    const ecosystemProduct = await prisma.ecosystemProduct.findUnique({
      where: { slug: productSlug },
    });

    if (!ecosystemProduct) {
      throw new Error(`Product not found: ${productSlug}`);
    }

    // Update the site product
    const updateData: any = {};

    if (updates.is_enabled !== undefined) {
      updateData.is_enabled = updates.is_enabled;
      updateData.disabled_at = updates.is_enabled ? null : new Date();
    }

    if (updates.config !== undefined) {
      updateData.config = updates.config;
    }

    if (updates.usage_limits !== undefined) {
      updateData.usage_limits = updates.usage_limits;
    }

    const siteProduct = await prisma.siteProduct.update({
      where: {
        site_id_product_id: {
          site_id: siteId,
          product_id: ecosystemProduct.id,
        },
      },
      data: updateData,
      include: {
        product: true,
      },
    });

    return {
      ...siteProduct,
      config: (siteProduct.config as Record<string, any>) || {},
      usage_limits: (siteProduct.usage_limits as Record<string, any>) || {},
      product: {
        ...siteProduct.product,
        features: (siteProduct.product.features as string[]) || [],
        limits: (siteProduct.product.limits as Record<string, any>) || {},
      },
    };
  } catch (error) {
    console.error("Error updating site product:", error);
    throw error;
  }
};

/**
 * Unregister a product from a site
 */
export const unregisterSiteProduct = async (
  siteId: string,
  productSlug: string
): Promise<void> => {
  try {
    // Find the ecosystem product
    const ecosystemProduct = await prisma.ecosystemProduct.findUnique({
      where: { slug: productSlug },
    });

    if (!ecosystemProduct) {
      throw new Error(`Product not found: ${productSlug}`);
    }

    // Delete the registration
    await prisma.siteProduct.delete({
      where: {
        site_id_product_id: {
          site_id: siteId,
          product_id: ecosystemProduct.id,
        },
      },
    });
  } catch (error) {
    console.error("Error unregistering site product:", error);
    throw error;
  }
};

/**
 * Check if a site has a specific product registered
 */
export const siteHasProduct = async (
  siteId: string,
  productSlug: string
): Promise<boolean> => {
  try {
    const ecosystemProduct = await prisma.ecosystemProduct.findUnique({
      where: { slug: productSlug },
    });

    if (!ecosystemProduct) return false;

    const siteProduct = await prisma.siteProduct.findUnique({
      where: {
        site_id_product_id: {
          site_id: siteId,
          product_id: ecosystemProduct.id,
        },
      },
    });

    return !!siteProduct && siteProduct.is_enabled;
  } catch (error) {
    console.error("Error checking site product:", error);
    return false;
  }
};

/**
 * Track product usage
 */
export const trackProductUsage = async (
  siteId: string,
  productSlug: string
): Promise<void> => {
  try {
    const ecosystemProduct = await prisma.ecosystemProduct.findUnique({
      where: { slug: productSlug },
    });

    if (!ecosystemProduct) return;

    await prisma.siteProduct.updateMany({
      where: {
        site_id: siteId,
        product_id: ecosystemProduct.id,
        is_enabled: true,
      },
      data: {
        last_used_at: new Date(),
        usage_count: {
          increment: 1,
        },
      },
    });
  } catch (error) {
    console.error("Error tracking product usage:", error);
    // Don't throw - usage tracking shouldn't break the main flow
  }
};
