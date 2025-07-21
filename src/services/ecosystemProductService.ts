/**
 * Product Service
 * Manages products and site registrations (unified from ecosystem products and plugins)
 */

import { prisma } from "../config/database";
import {
  Product,
  SiteProduct,
  RegisterSiteProductRequest,
  UpdateSiteProductRequest,
  CreateProductRequest,
  UpdateProductRequest,
} from "../types";

// Predefined products - aligned with licensing guide
const DEFAULT_PRODUCTS = [
  {
    name: "Lumen Neural Search API",
    slug: "lumen-search-api",
    description:
      "Complete neural search platform with AI-powered semantic search, vector embeddings, and natural language processing for content and e-commerce.",
    category: "search",
    version: "1.0",
    is_active: true,
    is_beta: false,
    base_price: 19.0, // Starting at Standard tier price
    usage_based: true,
    features: [
      "Semantic search across all content types",
      "Vector embeddings with pgvector",
      "Multi-language support",
      "Real-time indexing",
      "Search analytics and insights",
      "RESTful API access",
      "Usage tracking and billing",
      "Multi-tier licensing system"
    ],
    limits: {
      standard: { sites: 1, queries_per_month: 100, api_access: false },
      standard_plus: { sites: 1, queries_per_month: 100, api_access: true },
      premium: { sites: 1, queries_per_month: 2000, api_access: false },
      premium_plus: { sites: 1, queries_per_month: 2000, api_access: true },
      enterprise: { sites: 10, queries_per_month: -1, api_access: true }
    },
    extended_documentation: "Complete neural search solution with tiered pricing and comprehensive API access.",
  }
];

// Default pricing tiers - matching the licensing guide exactly
const DEFAULT_PRICING_TIERS = [
  {
    tier_name: "standard",
    display_name: "Standard",
    description: "Basic neural search with human UI access only",
    monthly_price: 19.00,
    annual_price: 205.00,
    max_queries: 100,
    max_sites: 1,
    agent_api_access: false,
    extra_site_price: null,
    overage_price: 0.50,
    custom_embedding_markup: null,
    features: [
      "100 queries per month",
      "1 site included",
      "Human UI access only",
      "Basic search analytics",
      "Email support"
    ],
    is_active: true,
    sort_order: 1
  },
  {
    tier_name: "standard_plus",
    display_name: "Standard+",
    description: "Basic neural search with agent/API access",
    monthly_price: 24.00,
    annual_price: 259.00,
    max_queries: 100,
    max_sites: 1,
    agent_api_access: true,
    extra_site_price: null,
    overage_price: 0.50,
    custom_embedding_markup: null,
    features: [
      "100 queries per month",
      "1 site included", 
      "Full API access for agents",
      "Advanced search analytics",
      "Priority email support"
    ],
    is_active: true,
    sort_order: 2
  },
  {
    tier_name: "premium",
    display_name: "Premium",
    description: "Advanced neural search with higher limits",
    monthly_price: 49.00,
    annual_price: 529.00,
    max_queries: 2000,
    max_sites: 1,
    agent_api_access: false,
    extra_site_price: null,
    overage_price: 0.50,
    custom_embedding_markup: null,
    features: [
      "2,000 queries per month",
      "1 site included",
      "Human UI access only",
      "Advanced analytics dashboard",
      "Priority support"
    ],
    is_active: true,
    sort_order: 3
  },
  {
    tier_name: "premium_plus", 
    display_name: "Premium+",
    description: "Advanced neural search with agent/API access",
    monthly_price: 59.00,
    annual_price: 637.00,
    max_queries: 2000,
    max_sites: 1,
    agent_api_access: true,
    extra_site_price: null,
    overage_price: 0.50,
    custom_embedding_markup: null,
    features: [
      "2,000 queries per month",
      "1 site included",
      "Full API access for agents",
      "Advanced analytics dashboard",
      "Priority support",
      "Webhook integrations"
    ],
    is_active: true,
    sort_order: 4
  },
  {
    tier_name: "enterprise",
    display_name: "Enterprise", 
    description: "Unlimited neural search with full features",
    monthly_price: 199.00,
    annual_price: 2149.00,
    max_queries: null, // Unlimited
    max_sites: 10,
    agent_api_access: true,
    extra_site_price: 15.00,
    overage_price: null, // No overages for unlimited
    custom_embedding_markup: 0.15, // 15% markup
    features: [
      "Unlimited queries",
      "10 sites included",
      "Full API access for agents",
      "Custom embedding models",
      "Dedicated support",
      "SLA guarantees",
      "Custom integrations"
    ],
    is_active: true,
    sort_order: 5
  }
];

/**
 * Initialize default products in the database
 */
export const initializeDefaultProducts = async (): Promise<void> => {
  try {
    console.log("🛍️ Initializing default products...");
    for (const productData of DEFAULT_PRODUCTS) {
      await prisma.product.upsert({
        where: { slug: productData.slug },
        update: {
          name: productData.name,
          description: productData.description,
          category: productData.category,
          version: productData.version,
          is_active: productData.is_active,
          is_beta: productData.is_beta,
          base_price: productData.base_price,
          usage_based: productData.usage_based,
          features: productData.features,
          limits: productData.limits,
          extended_documentation: productData.extended_documentation,
        },
        create: productData,
      });
      console.log(`✅ Product upserted: ${productData.name}`);
    }
    console.log("✅ Default products initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing default products:", error);
    throw error;
  }
};

/**
 * Initialize default pricing tiers in the database
 */
export const initializeDefaultPricingTiers = async (): Promise<void> => {
  try {
    console.log("💰 Initializing default pricing tiers...");
    
    // First, get the main product to link pricing tiers to
    const mainProduct = await prisma.product.findUnique({
      where: { slug: "lumen-search-api" }
    });
    
    if (!mainProduct) {
      throw new Error("Main product 'lumen-search-api' not found. Please initialize products first.");
    }

    for (const tierData of DEFAULT_PRICING_TIERS) {
      await prisma.pricingTier.upsert({
        where: { 
          product_id_tier_name: {
            product_id: mainProduct.id,
            tier_name: tierData.tier_name
          }
        },
        update: {
          display_name: tierData.display_name,
          description: tierData.description,
          monthly_price: tierData.monthly_price,
          annual_price: tierData.annual_price,
          max_queries: tierData.max_queries,
          max_sites: tierData.max_sites,
          agent_api_access: tierData.agent_api_access,
          extra_site_price: tierData.extra_site_price,
          overage_price: tierData.overage_price,
          custom_embedding_markup: tierData.custom_embedding_markup,
          features: tierData.features,
          is_active: tierData.is_active,
          sort_order: tierData.sort_order,
        },
        create: {
          product_id: mainProduct.id,
          ...tierData,
        },
      });
      console.log(`✅ Pricing tier upserted: ${tierData.display_name}`);
    }
    
    console.log("✅ Default pricing tiers initialized successfully");
  } catch (error) {
    console.error("❌ Error initializing default pricing tiers:", error);
    throw error;
  }
};

/**
 * Initialize both products and pricing tiers (complete setup)
 */
export const initializeCompleteSystem = async (): Promise<void> => {
  try {
    console.log("🚀 Initializing complete licensing system...");
    
    // Initialize products first
    await initializeDefaultProducts();
    
    // Then initialize pricing tiers
    await initializeDefaultPricingTiers();
    
    console.log("🎉 Complete licensing system initialized successfully!");
  } catch (error) {
    console.error("❌ Error initializing complete system:", error);
    throw error;
  }
};

/**
 * Get all active products
 */
export const getAllProducts = async (): Promise<
  Product[]
> => {
  try {
    const products = await prisma.product.findMany({
      where: { is_active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return products.map((product: any) => ({
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
    }));
  } catch (error) {
    console.error("Error getting products:", error);
    throw error;
  }
};

/**
 * Get products by category
 */
export const getProductsByCategory = async (
  category: string
): Promise<Product[]> => {
  try {
    const products = await prisma.product.findMany({
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
      extended_documentation: (product.extended_documentation as string) || "",
    }));
  } catch (error) {
    console.error(`Error getting products for category ${category}:`, error);
    throw error;
  }
};

/**
 * Get single product by slug
 */
export const getProductBySlug = async (
  slug: string
): Promise<Product | null> => {
  try {
    const product = await prisma.product.findUnique({
      where: { slug },
    });

    if (!product) return null;

    return {
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
    };
  } catch (error) {
    console.error(`Error getting product by slug ${slug}:`, error);
    throw error;
  }
};

/**
 * Create a new product
 */
export const createProduct = async (
  request: CreateProductRequest
): Promise<Product> => {
  try {
    const product = await prisma.product.create({
      data: {
        name: request.name,
        slug: request.slug,
        description: request.description,
        category: request.category,
        version: request.version,
        is_active: request.is_active,
        is_beta: request.is_beta,
        base_price: request.base_price,
        usage_based: request.usage_based,
        features: request.features,
        limits: request.limits,
        extended_documentation: request.extended_documentation,
      },
    });

    return {
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
    };
  } catch (error) {
    console.error("Error creating product:", error);
    throw error;
  }
};

/**
 * Update an existing product
 */
export const updateProduct = async (
  slug: string,
  updates: UpdateProductRequest
): Promise<Product> => {
  try {
    const product = await prisma.product.update({
      where: { slug },
      data: {
        name: updates.name,
        description: updates.description,
        version: updates.version,
        is_active: updates.is_active,
        is_beta: updates.is_beta,
        base_price: updates.base_price,
        usage_based: updates.usage_based,
        features: updates.features,
        limits: updates.limits,
        extended_documentation: updates.extended_documentation,
        is_public: updates.is_public,
        release_notes: updates.release_notes,
        changelog: updates.changelog,
        max_downloads: updates.max_downloads,
      },
    });

    return {
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
      filename: product.filename || undefined,
      file_path: product.file_path || undefined,
      file_size: product.file_size || undefined,
      file_hash: product.file_hash || undefined,
      content_type: product.content_type || undefined,
      is_public: product.is_public,
      release_notes: product.release_notes || undefined,
      changelog: product.changelog || undefined,
      max_downloads: product.max_downloads || undefined,
      created_at: product.created_at.toISOString(),
      updated_at: product.updated_at.toISOString(),
    };
  } catch (error) {
    console.error("Error updating product:", error);
    throw error;
  }
};

/**
 * Delete a product
 */
export const deleteProduct = async (
  slug: string
): Promise<void> => {
  try {
    await prisma.product.delete({
      where: { slug },
    });
    console.log(`✅ Deleted product with slug: ${slug}`);
  } catch (error) {
    console.error(
      `❌ Failed to delete product: ${slug}`,
      error
    );
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
    // Find the product
    const product = await prisma.product.findUnique({
      where: { slug: request.product_slug },
    });

    if (!product) {
      throw new Error(`Product not found: ${request.product_slug}`);
    }

    if (!product.is_active) {
      throw new Error(`Product is not active: ${request.product_slug}`);
    }

    // Check if already registered
    const existingRegistration = await prisma.siteProduct.findUnique({
      where: {
        site_id_product_id: {
          site_id: siteId,
          product_id: product.id,
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
        product_id: product.id,
        config: request.config || {},
        is_enabled: true,
      },
      include: {
        product: true,
      },
    });

    return {
      id: siteProduct.id,
      site_id: siteProduct.site_id,
      product_id: siteProduct.product_id,
      is_enabled: siteProduct.is_enabled,
      enabled_at: siteProduct.enabled_at.toISOString(),
      disabled_at: siteProduct.disabled_at?.toISOString(),
      config: (siteProduct.config as Record<string, any>) || {},
      usage_limits: (siteProduct.usage_limits as Record<string, any>) || {},
      last_used_at: siteProduct.last_used_at?.toISOString(),
      usage_count: siteProduct.usage_count,
      created_at: siteProduct.created_at.toISOString(),
      updated_at: siteProduct.updated_at.toISOString(),
      product: {
        id: siteProduct.product.id,
        name: siteProduct.product.name,
        slug: siteProduct.product.slug,
        description: siteProduct.product.description,
        category: siteProduct.product.category,
        version: siteProduct.product.version,
        is_active: siteProduct.product.is_active,
        is_beta: siteProduct.product.is_beta,
        base_price: siteProduct.product.base_price ?? undefined,
        usage_based: siteProduct.product.usage_based,
        features: (siteProduct.product.features as string[]) || [],
        limits: (siteProduct.product.limits as Record<string, any>) || {},
        extended_documentation: siteProduct.product.extended_documentation || "",
        filename: siteProduct.product.filename ?? undefined,
        file_path: siteProduct.product.file_path ?? undefined,
        file_size: siteProduct.product.file_size ?? undefined,
        file_hash: siteProduct.product.file_hash ?? undefined,
        content_type: siteProduct.product.content_type ?? undefined,
        is_public: siteProduct.product.is_public ?? false,
        release_notes: siteProduct.product.release_notes ?? undefined,
        changelog: siteProduct.product.changelog ?? undefined,
        max_downloads: siteProduct.product.max_downloads ?? undefined,
        created_at: siteProduct.product.created_at.toISOString(),
        updated_at: siteProduct.product.updated_at.toISOString(),
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
        extended_documentation:
          (sp.product.extended_documentation as string) || "",
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
    // Find the product
    const product = await prisma.product.findUnique({
      where: { slug: productSlug },
    });

    if (!product) {
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
          product_id: product.id,
        },
      },
      data: updateData,
      include: {
        product: true,
      },
    });

    return {
      id: siteProduct.id,
      site_id: siteProduct.site_id,
      product_id: siteProduct.product_id,
      is_enabled: siteProduct.is_enabled,
      enabled_at: siteProduct.enabled_at.toISOString(),
      disabled_at: siteProduct.disabled_at?.toISOString(),
      config: (siteProduct.config as Record<string, any>) || {},
      usage_limits: (siteProduct.usage_limits as Record<string, any>) || {},
      last_used_at: siteProduct.last_used_at?.toISOString(),
      usage_count: siteProduct.usage_count,
      created_at: siteProduct.created_at.toISOString(),
      updated_at: siteProduct.updated_at.toISOString(),
      product: {
        id: siteProduct.product.id,
        name: siteProduct.product.name,
        slug: siteProduct.product.slug,
        description: siteProduct.product.description,
        category: siteProduct.product.category,
        version: siteProduct.product.version,
        is_active: siteProduct.product.is_active,
        is_beta: siteProduct.product.is_beta,
        base_price: siteProduct.product.base_price ?? undefined,
        usage_based: siteProduct.product.usage_based,
        features: (siteProduct.product.features as string[]) || [],
        limits: (siteProduct.product.limits as Record<string, any>) || {},
        extended_documentation: siteProduct.product.extended_documentation || "",
        filename: siteProduct.product.filename ?? undefined,
        file_path: siteProduct.product.file_path ?? undefined,
        file_size: siteProduct.product.file_size ?? undefined,
        file_hash: siteProduct.product.file_hash ?? undefined,
        content_type: siteProduct.product.content_type ?? undefined,
        is_public: siteProduct.product.is_public ?? false,
        release_notes: siteProduct.product.release_notes ?? undefined,
        changelog: siteProduct.product.changelog ?? undefined,
        max_downloads: siteProduct.product.max_downloads ?? undefined,
        created_at: siteProduct.product.created_at.toISOString(),
        updated_at: siteProduct.product.updated_at.toISOString(),
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
    // Find the product
    const product = await prisma.product.findUnique({
      where: { slug: productSlug },
    });

    if (!product) {
      throw new Error(`Product not found: ${productSlug}`);
    }

    // Delete the registration
    await prisma.siteProduct.delete({
      where: {
        site_id_product_id: {
          site_id: siteId,
          product_id: product.id,
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
    const product = await prisma.product.findUnique({
      where: { slug: productSlug },
    });

    if (!product) return false;

    const siteProduct = await prisma.siteProduct.findUnique({
      where: {
        site_id_product_id: {
          site_id: siteId,
          product_id: product.id,
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
    const product = await prisma.product.findUnique({
      where: { slug: productSlug },
    });

    if (!product) return;

    await prisma.siteProduct.updateMany({
      where: {
        site_id: siteId,
        product_id: product.id,
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

/**
 * Debug function - Get ALL products (including inactive)
 */
export const debugAllProducts = async (): Promise<any[]> => {
  try {
    const products = await prisma.product.findMany({
      orderBy: [{ created_at: "asc" }],
    });

    console.log("=== ALL PRODUCTS IN DATABASE ===");
    products.forEach((product: any, index: number) => {
      console.log(`${index + 1}. ID: ${product.id}`);
      console.log(`   Name: ${product.name}`);
      console.log(`   Slug: ${product.slug}`);
      console.log(`   Active: ${product.is_active}`);
      console.log(`   Created: ${product.created_at}`);
      console.log(`   Updated: ${product.updated_at}`);
      console.log("   ---");
    });
    console.log("=== END DATABASE DUMP ===");

    return products;
  } catch (error) {
    console.error("Error debugging products:", error);
    throw error;
  }
};

/**
 * Delete a product (admin function)
 */
export const deleteProductAdmin = async (
  slug: string
): Promise<void> => {
  try {
    await prisma.product.delete({
      where: { slug },
    });
    console.log(`✅ Deleted product with slug: ${slug}`);
  } catch (error) {
    console.error(
      `❌ Failed to delete product: ${slug}`,
      error
    );
    throw error;
  }
};

/**
 * Manual cleanup and reinitialize (one-time fix)
 */
export const cleanupAndReinitializeProducts = async (): Promise<void> => {
  console.log("🧹 Starting manual cleanup and reinitialization...");

  try {
    // Step 1: Delete all existing products
    console.log("🗑️  Deleting all existing products...");
    await prisma.product.deleteMany({});
    console.log("✅ All existing products deleted");

    // Step 2: Create fresh products from the array
    console.log("🆕 Creating fresh products...");
    for (const productData of DEFAULT_PRODUCTS) {
      await prisma.product.create({
        data: {
          ...productData,
          features: productData.features,
          limits: productData.limits,
        },
      });
      console.log(`✅ Created: ${productData.name}`);
    }

    console.log("🎉 Cleanup and reinitialization completed successfully!");
  } catch (error) {
    console.error("❌ Failed during cleanup and reinitialization:", error);
    throw error;
  }
};
