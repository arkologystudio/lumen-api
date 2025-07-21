/**
 * Pricing Controller
 * Handles pricing tier information and billing-related endpoints
 */

import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { PrismaClient } from "@prisma/client";
import { LicenseType, BillingPeriod, PricingTier } from "../types";

const prisma = new PrismaClient();

/**
 * Pricing configuration for all products
 */
const PRICING_CONFIG: Record<
  LicenseType,
  {
    monthly_price: number;
    annual_price: number;
    max_queries: number | null;
    max_sites: number;
    agent_api_access: boolean;
    features: string[];
    description: string;
  }
> = {
  trial: {
    monthly_price: 0,
    annual_price: 0,
    max_queries: 50,
    max_sites: 1,
    agent_api_access: false,
    features: ["Basic search", "50 queries/month", "Single site"],
    description:
      "Basic semantic search for a single site's knowledge base or product catalog via the human-facing UI.",
  },
  standard: {
    monthly_price: 19,
    annual_price: 205,
    max_queries: 100,
    max_sites: 1,
    agent_api_access: false,
    features: [
      "Semantic search",
      "100 queries/month",
      "Single site",
      "Human UI access",
    ],
    description:
      "Basic semantic search for a single site's knowledge base or product catalog via the human-facing UI.",
  },
  standard_plus: {
    monthly_price: 24,
    annual_price: 259,
    max_queries: 100,
    max_sites: 1,
    agent_api_access: true,
    features: [
      "Semantic search",
      "100 queries/month",
      "Single site",
      "Human UI access",
      "Agent/API access",
    ],
    description:
      "Everything in Standard, plus programmatic access (agent/API) so bots and AI agents can query your content.",
  },
  premium: {
    monthly_price: 49,
    annual_price: 529,
    max_queries: 2000,
    max_sites: 1,
    agent_api_access: false,
    features: [
      "Advanced search",
      "2000 queries/month",
      "Single site",
      "Human UI access",
      "Priority support",
    ],
    description:
      "Higher-volume plan for growing sites that need more monthly queries, still UI-only.",
  },
  premium_plus: {
    monthly_price: 59,
    annual_price: 637,
    max_queries: 2000,
    max_sites: 1,
    agent_api_access: true,
    features: [
      "Advanced search",
      "2000 queries/month",
      "Single site",
      "Human UI access",
      "Agent/API access",
      "Priority support",
    ],
    description:
      "All Premium features, with agent/API access for integrations and autonomous agents.",
  },
  enterprise: {
    monthly_price: 199,
    annual_price: 2149,
    max_queries: null,
    max_sites: 10,
    agent_api_access: true,
    features: [
      "Unlimited queries",
      "Up to 10 sites",
      "Agent/API access",
      "Priority support",
      "Custom SLA",
      "Dedicated onboarding",
    ],
    description:
      "Unlimited queries and multi-site support, with white-glove SLAs and priority support.",
  },
};

/**
 * Add-on pricing
 */
const ADD_ON_PRICING = {
  extra_site_price: 15, // $15/month per additional site (enterprise only)
  query_overage_price: 0.5, // $0.50 per 100 extra queries (standard/premium only)
  custom_embedding_markup: 15, // 15% markup on base price
};

/**
 * GET /api/pricing/tiers
 * Get all available pricing tiers
 */
export const getPricingTiers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const tiers = Object.entries(PRICING_CONFIG).map(
      ([tierName, config], index) => ({
        id: tierName,
        tier_name: tierName,
        display_name: tierName
          .replace("_", "+")
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
        description: config.description,
        monthly_price: config.monthly_price,
        annual_price: config.annual_price,
        max_queries: config.max_queries ?? undefined,
        max_sites: config.max_sites,
        agent_api_access: config.agent_api_access,
        extra_site_price:
          tierName === "enterprise"
            ? ADD_ON_PRICING.extra_site_price
            : undefined,
        overage_price:
          tierName !== "enterprise"
            ? ADD_ON_PRICING.query_overage_price
            : undefined,
        custom_embedding_markup: ADD_ON_PRICING.custom_embedding_markup,
        features: config.features,
        is_active: true,
        sort_order: index,
      })
    );

    res.json({
      success: true,
      tiers,
      add_ons: {
        extra_site_price: ADD_ON_PRICING.extra_site_price,
        query_overage_price: ADD_ON_PRICING.query_overage_price,
        custom_embedding_markup: ADD_ON_PRICING.custom_embedding_markup,
      },
      total: tiers.length,
    });
  } catch (error) {
    console.error("Error getting pricing tiers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get pricing tiers",
    });
  }
};

/**
 * GET /api/pricing/tiers/:tier_name
 * Get specific pricing tier details
 */
export const getPricingTier = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { tier_name } = req.params;

    if (!PRICING_CONFIG[tier_name as LicenseType]) {
      res.status(404).json({
        success: false,
        error: "Pricing tier not found",
      });
      return;
    }

    const config = PRICING_CONFIG[tier_name as LicenseType];
    const tier = {
      id: tier_name,
      tier_name,
      display_name: tier_name
        .replace("_", "+")
        .split(" ")
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
      description: config.description,
      monthly_price: config.monthly_price,
      annual_price: config.annual_price,
      max_queries: config.max_queries ?? undefined,
      max_sites: config.max_sites,
      agent_api_access: config.agent_api_access,
      extra_site_price:
        tier_name === "enterprise"
          ? ADD_ON_PRICING.extra_site_price
          : undefined,
      overage_price:
        tier_name !== "enterprise"
          ? ADD_ON_PRICING.query_overage_price
          : undefined,
      custom_embedding_markup: ADD_ON_PRICING.custom_embedding_markup,
      features: config.features,
      is_active: true,
      sort_order: Object.keys(PRICING_CONFIG).indexOf(tier_name),
    };

    res.json({
      success: true,
      tier,
    });
  } catch (error) {
    console.error("Error getting pricing tier:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get pricing tier",
    });
  }
};

/**
 * POST /api/pricing/calculate
 * Calculate pricing for a configuration
 */
export const calculatePricing = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      license_type,
      billing_period = "monthly",
      additional_sites = 0,
      custom_embedding = false,
      query_overage = 0,
    } = req.body;

    if (!license_type || !PRICING_CONFIG[license_type as LicenseType]) {
      res.status(400).json({
        success: false,
        error: "Valid license type is required",
      });
      return;
    }

    // Validate enterprise-only features
    if (additional_sites > 0 && license_type !== "enterprise") {
      res.status(400).json({
        success: false,
        error: "Additional sites are only available with Enterprise license",
      });
      return;
    }

    const config = PRICING_CONFIG[license_type as LicenseType];
    const basePrice =
      billing_period === "annual" ? config.annual_price : config.monthly_price;

    // Calculate add-on costs
    const extraSitesCost = additional_sites * ADD_ON_PRICING.extra_site_price;
    const customEmbeddingCost = custom_embedding
      ? basePrice * (ADD_ON_PRICING.custom_embedding_markup / 100)
      : 0;
    const queryOverageCost = query_overage * ADD_ON_PRICING.query_overage_price;

    const totalPrice =
      basePrice + extraSitesCost + customEmbeddingCost + queryOverageCost;

    // Calculate annual savings
    const annualSavings =
      billing_period === "annual"
        ? config.monthly_price * 12 - config.annual_price
        : 0;

    const annualSavingsPercentage =
      billing_period === "annual"
        ? Math.round(
            ((config.monthly_price * 12 - config.annual_price) /
              (config.monthly_price * 12)) *
              100
          )
        : 0;

    res.json({
      success: true,
      pricing: {
        license_type,
        billing_period,
        base_price: basePrice,
        add_ons: {
          additional_sites: {
            count: additional_sites,
            unit_price: ADD_ON_PRICING.extra_site_price,
            total_cost: extraSitesCost,
          },
          custom_embedding: {
            enabled: custom_embedding,
            markup_percentage: ADD_ON_PRICING.custom_embedding_markup,
            total_cost: customEmbeddingCost,
          },
          query_overage: {
            count: query_overage,
            unit_price: ADD_ON_PRICING.query_overage_price,
            total_cost: queryOverageCost,
          },
        },
        total_price: totalPrice,
        annual_savings: annualSavings,
        annual_savings_percentage: annualSavingsPercentage,
        currency: "usd",
      },
      tier_details: {
        tier_name: license_type,
        display_name: license_type
          .replace("_", "+")
          .split(" ")
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
        max_queries: config.max_queries ?? undefined,
        max_sites: config.max_sites,
        agent_api_access: config.agent_api_access,
        features: config.features,
      },
    });
  } catch (error) {
    console.error("Error calculating pricing:", error);
    res.status(500).json({
      success: false,
      error: "Failed to calculate pricing",
    });
  }
};

/**
 * GET /api/pricing/products/:product_slug/tiers
 * Get pricing tiers for a specific product
 */
export const getProductPricingTiers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { product_slug } = req.params;

    // Find the product
    const product = await prisma.ecosystemProduct.findUnique({
      where: { slug: product_slug },
    });

    if (!product) {
      res.status(404).json({
        success: false,
        error: "Product not found",
      });
      return;
    }

    if (!product.is_active) {
      res.status(400).json({
        success: false,
        error: "Product is not active",
      });
      return;
    }

    // Generate pricing tiers for this product
    const pricing_tiers = Object.entries(PRICING_CONFIG).map(
      ([tierName, config], index) => ({
        id: `${product.id}-${tierName}`,
        product_id: product.id,
        tier_name: tierName,
        display_name: tierName
          .replace("_", "+")
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
        description: config.description,
        monthly_price: config.monthly_price,
        annual_price: config.annual_price,
        max_queries: config.max_queries ?? undefined,
        max_sites: config.max_sites,
        agent_api_access: config.agent_api_access,
        extra_site_price:
          tierName === "enterprise"
            ? ADD_ON_PRICING.extra_site_price
            : undefined,
        overage_price:
          tierName !== "enterprise"
            ? ADD_ON_PRICING.query_overage_price
            : undefined,
        custom_embedding_markup: ADD_ON_PRICING.custom_embedding_markup,
        features: config.features,
        is_active: true,
        sort_order: index,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    );

    res.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        category: product.category,
      },
      pricing_tiers,
      add_ons: {
        extra_site_price: ADD_ON_PRICING.extra_site_price,
        query_overage_price: ADD_ON_PRICING.query_overage_price,
        custom_embedding_markup: ADD_ON_PRICING.custom_embedding_markup,
      },
      total: pricing_tiers.length,
    });
  } catch (error) {
    console.error("Error getting product pricing tiers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get product pricing tiers",
    });
  }
};

/**
 * GET /api/pricing/comparison
 * Get pricing tier comparison data
 */
export const getPricingComparison = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const comparison = {
      tiers: Object.entries(PRICING_CONFIG).map(
        ([tierName, config], index) => ({
          tier_name: tierName,
          display_name: tierName
            .replace("_", "+")
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
          monthly_price: config.monthly_price,
          annual_price: config.annual_price,
          max_queries: config.max_queries,
          max_sites: config.max_sites,
          agent_api_access: config.agent_api_access,
          features: config.features,
          sort_order: index,
          recommended: tierName === "standard_plus", // Mark standard+ as recommended
        })
      ),
      features: [
        {
          name: "Monthly Queries",
          standard: "100",
          standard_plus: "100",
          premium: "2,000",
          premium_plus: "2,000",
          enterprise: "Unlimited",
        },
        {
          name: "Sites Included",
          standard: "1",
          standard_plus: "1",
          premium: "1",
          premium_plus: "1",
          enterprise: "Up to 10",
        },
        {
          name: "Agent/API Access",
          standard: false,
          standard_plus: true,
          premium: false,
          premium_plus: true,
          enterprise: true,
        },
        {
          name: "Priority Support",
          standard: false,
          standard_plus: false,
          premium: true,
          premium_plus: true,
          enterprise: true,
        },
        {
          name: "Custom SLA",
          standard: false,
          standard_plus: false,
          premium: false,
          premium_plus: false,
          enterprise: true,
        },
        {
          name: "Query Overage",
          standard: "$0.50 per 100",
          standard_plus: "$0.50 per 100",
          premium: "$0.50 per 100",
          premium_plus: "$0.50 per 100",
          enterprise: "Not applicable",
        },
        {
          name: "Additional Sites",
          standard: "Not available",
          standard_plus: "Not available",
          premium: "Not available",
          premium_plus: "Not available",
          enterprise: "$15/month each",
        },
      ],
      add_ons: {
        extra_site_price: ADD_ON_PRICING.extra_site_price,
        query_overage_price: ADD_ON_PRICING.query_overage_price,
        custom_embedding_markup: ADD_ON_PRICING.custom_embedding_markup,
      },
    };

    res.json({
      success: true,
      comparison,
    });
  } catch (error) {
    console.error("Error getting pricing comparison:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get pricing comparison",
    });
  }
};
