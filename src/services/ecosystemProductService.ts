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
    extended_documentation: "",
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
    extended_documentation: "",
  },
  {
    name: "AI Ready Core",
    slug: "ai-ready-core",
    description:
      "Transform your WordPress site for the Agentic Web. Enhance discoverability and conversions by AI Agents.",
    category: "analysis",
    version: "1.0",
    is_active: true,
    is_beta: true,
    base_price: 19.0,
    usage_based: false,
    features: [
      "AI-Readiness Diagnostics with 0-100% scoring",
      "llms.txt generation and serving",
      "Agent Gate for robots.txt configuration",
      "AI bot permissions management (GPTBot, Claude-Web, etc.)",
      "JSON-LD structured data validation",
      "Content analysis and cataloging",
      "Security and performance optimizations",
      "Translation system support",
    ],
    limits: {
      free: { sites: 1, analyses_per_month: 2 },
      pro: { sites: 10, analyses_per_month: 20 },
      enterprise: { sites: -1, analyses_per_month: -1 },
    },
    extended_documentation: `=== AI-Ready Core ===
Contributors: Arkology Studio
Tags: ai, llm, seo, chatgpt, claude
Requires at least: 5.0
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Transform your WordPress site for the Agentic Web. Enhance discoverability and conversions by AI Agents.

== Description ==

AI agents are becoming the new browsers and web surfers. As AI agents become increasingly autonomous they'll begin to make up the vast majority of website traffic, browsing and even purchasing products online.
Already today, chatbots like ChatGPT, Claude, and Perplexity increasingly access web content. AI Ready is a suite of tools for optimizing your website for AI discoverability and comprehension, ultimately leading to increased traffic and conversions.

= Key Features =

•⁠  ⁠*AI-Readiness Diagnostics*
  * 0-100% AI-Ready score with detailed breakdown
  * Checks llms.txt accessibility and validity
  * Validates robots.txt AI bot permissions (GPTBot, Claude-Web, etc.)
  * Detects noai meta tags
  * Checks JSON-LD structured data presence
  * Additional checks for XML sitemaps, accessibility, and SEO

•⁠  ⁠*llms.txt Generation*
  * Serves ⁠ /llms.txt ⁠ with proper ⁠ text/plain ⁠ content type
  * Automatically finds and catalogs your published pages
  * Extracts meaningful page descriptions using content analysis
  * Refreshes content when pages are published or updated
  * Allows advanced users to add custom markdown sections

•⁠  ⁠*Agent Gate*
  * Configure robots.txt to allow or block specific AI agents (GPTBot, Claude-Web, Perplexity, etc.)

== Installation ==

1.⁠ ⁠Upload the ⁠ ai-ready-core ⁠ folder to the ⁠ /wp-content/plugins/ ⁠ directory
2.⁠ ⁠Activate the plugin through the 'Plugins' menu in WordPress
3.⁠ ⁠Navigate to ⁠ Settings → AI Ready ⁠ to configure the plugin
4.⁠ ⁠Run the diagnostics to check your site's AI-readiness score
5.⁠ ⁠Generate your site's llms.txt file (available at ⁠ yoursite.com/llms.txt ⁠, once ready)
6.⁠ ⁠Configure how and which agents should access your website under the Agent Gate menu.

Alternatively, you can install via WordPress admin:

1.⁠ ⁠Go to ⁠ Plugins → Add New → Upload Plugin ⁠
2.⁠ ⁠Choose the plugin ZIP file and click "Install Now"
3.⁠ ⁠Activate the plugin
4.⁠ ⁠Navigate to ⁠ Settings → AI Ready ⁠ to configure

== Frequently Asked Questions ==

= What is llms.txt? =

llms.txt is an emerging standard for AI agent navigation, similar to robots.txt but specifically designed for AI language models and chatbots. It helps AI agents better understand and navigate your website content.

= Does this plugin send data to external services? =

No. AI-Ready Core works completely locally with no external dependencies. All processing happens on your server, and no data is sent to external services.

= Will this affect my site's performance? =

The plugin is designed to be extremely lightweight and uses intelligent caching. The llms.txt generation process only runs when content is updated, and diagnostics are run on-demand.

= Is this compatible with caching plugins? =

Yes, AI-Ready Core works with popular WordPress caching plugins and includes proper cache invalidation when content is updated.

= Does this work with multilingual sites? =

Yes, the plugin is translation-ready and can handle multilingual content. The llms.txt generator will include content in all available languages.

== Screenshots ==

1.⁠ ⁠Diagnostics Dashboard - AI-readiness scoring with detailed status checks
2.⁠ ⁠Configuration Panel - llms.txt settings with live preview
3.⁠ ⁠llms.txt Output - Clean, standardized format for AI agent consumption
4.⁠ ⁠Loading States - Professional animations and user feedback

== Changelog ==

= 1.0.0 =
•⁠  ⁠Initial release
•⁠  ⁠llms.txt generation and serving
•⁠  ⁠AI-readiness diagnostics
•⁠  ⁠Admin interface with configuration options
•⁠  ⁠Security and performance optimizations
•⁠  ⁠Translation system implementation

== Upgrade Notice ==

= 1.0.0 =
First public release of AI-Ready Core. Install to make your WordPress site AI-ready!`,
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
      extended_documentation: (product.extended_documentation as string) || "",
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
      extended_documentation: (product.extended_documentation as string) || "",
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
      extended_documentation: (product.extended_documentation as string) || "",
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
        extended_documentation:
          (siteProduct.product.extended_documentation as string) || "",
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
        extended_documentation:
          (siteProduct.product.extended_documentation as string) || "",
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

/**
 * Debug function - Get ALL ecosystem products (including inactive)
 */
export const debugAllEcosystemProducts = async (): Promise<any[]> => {
  try {
    const products = await prisma.ecosystemProduct.findMany({
      orderBy: [{ created_at: "asc" }],
    });

    console.log("=== ALL ECOSYSTEM PRODUCTS IN DATABASE ===");
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
    console.error("Error debugging ecosystem products:", error);
    throw error;
  }
};

/**
 * Delete an ecosystem product (admin function)
 */
export const deleteEcosystemProduct = async (
  identifier: string
): Promise<void> => {
  try {
    // Try to parse as ID first, then use as slug
    const isId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier
      );

    if (isId) {
      await prisma.ecosystemProduct.delete({
        where: { id: identifier },
      });
      console.log(`✅ Deleted ecosystem product with ID: ${identifier}`);
    } else {
      await prisma.ecosystemProduct.delete({
        where: { slug: identifier },
      });
      console.log(`✅ Deleted ecosystem product with slug: ${identifier}`);
    }
  } catch (error) {
    console.error(
      `❌ Failed to delete ecosystem product: ${identifier}`,
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
    // Step 1: Delete all existing ecosystem products
    console.log("🗑️  Deleting all existing ecosystem products...");
    await prisma.ecosystemProduct.deleteMany({});
    console.log("✅ All existing products deleted");

    // Step 2: Create fresh products from the array
    console.log("🆕 Creating fresh products...");
    for (const productData of ECOSYSTEM_PRODUCTS) {
      await prisma.ecosystemProduct.create({
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
