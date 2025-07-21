/**
 * Purchase Controller
 * Handles product purchases with tiered pricing model
 */

import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { PrismaClient } from "@prisma/client";
import { createLicense } from "../services/licenseService";
import {
  PurchaseRequest,
  SimulatePurchaseRequest,
  PurchaseResponse,
  AvailableProductResponse,
  PurchaseHistoryItem,
  GiftLicenseRequest,
  LicenseType,
  BillingPeriod,
} from "../types";
import {
  logActivityWithRequest,
  ACTIVITY_TYPES,
} from "../services/activityLogService";

const prisma = new PrismaClient();

/**
 * Pricing configuration for products
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
  }
> = {
  trial: {
    monthly_price: 0,
    annual_price: 0,
    max_queries: 50,
    max_sites: 1,
    agent_api_access: false,
    features: ["Basic search", "50 queries/month", "Single site"],
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
  },
};

/**
 * POST /api/purchases/simulate
 * Simulate a product purchase and automatically create a license
 */
export const simulatePurchase = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const {
      product_slug,
      license_type = "standard",
      billing_period = "monthly",
      additional_sites = 0,
      custom_embedding = false,
      payment_reference,
    }: SimulatePurchaseRequest = req.body;

    if (!product_slug) {
      res.status(400).json({
        success: false,
        error: "Product slug is required",
      });
      return;
    }

    // Validate license type
    if (!PRICING_CONFIG[license_type as LicenseType]) {
      res.status(400).json({
        success: false,
        error: "Invalid license type",
      });
      return;
    }

    // Find the ecosystem product
    const product = await prisma.ecosystemProduct.findUnique({
      where: { slug: product_slug },
      include: {
        plugins: {
          where: { is_active: true },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
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
        error: "Product is not available for purchase",
      });
      return;
    }

    // Check if user already has a license for this product
    const existingLicense = await prisma.license.findUnique({
      where: {
        user_id_product_id: {
          user_id: req.user.id,
          product_id: product.id,
        },
      },
    });

    if (existingLicense) {
      res.status(400).json({
        success: false,
        error: "You already have a license for this product",
        existing_license: {
          id: existingLicense.id,
          license_key: existingLicense.license_key,
          license_type: existingLicense.license_type,
          status: existingLicense.status,
        },
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

    // Generate a simulated payment reference if not provided
    const simulatedPaymentRef =
      payment_reference ||
      `SIM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get pricing configuration
    const pricingConfig = PRICING_CONFIG[license_type as LicenseType];
    const basePrice =
      billing_period === "annual"
        ? pricingConfig.annual_price
        : pricingConfig.monthly_price;

    const extraSitesCost = additional_sites * 15; // $15 per extra site
    const customEmbeddingCost = custom_embedding ? basePrice * 0.15 : 0; // 15% markup
    const totalPrice = basePrice + extraSitesCost + customEmbeddingCost;

    // Create the license
    const license = await createLicense({
      user_id: req.user.id,
      product_slug,
      license_type: license_type as LicenseType,
      billing_period: billing_period as BillingPeriod,
      additional_sites,
      custom_embedding,
      purchase_reference: simulatedPaymentRef,
      notes: "License created via purchase simulation",
      metadata: {
        simulated_purchase: true,
        product_slug,
        purchase_date: new Date().toISOString(),
        payment_reference: simulatedPaymentRef,
        pricing_details: {
          base_price: basePrice,
          extra_sites_cost: extraSitesCost,
          custom_embedding_cost: customEmbeddingCost,
          total_price: totalPrice,
        },
      },
    });

    // Log purchase activity
    try {
      await logActivityWithRequest(
        req,
        req.user.id,
        ACTIVITY_TYPES.PRODUCT_REGISTERED,
        `Purchased ${product.name} - ${license_type}`,
        {
          description: `User purchased ${product.name} (${license_type}) - License ${license.license_key} created`,
          metadata: {
            product_id: product.id,
            product_slug: product.slug,
            license_id: license.id,
            license_key: license.license_key,
            license_type,
            billing_period,
            amount_paid: totalPrice,
            payment_reference: simulatedPaymentRef,
            simulated_purchase: true,
          },
        }
      );
    } catch (activityError) {
      console.error("Failed to log purchase activity:", activityError);
    }

    const response: PurchaseResponse = {
      success: true,
      purchase: {
        purchase_reference: simulatedPaymentRef,
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          category: product.category,
          version: product.version,
          is_active: product.is_active,
          is_beta: product.is_beta,
          base_price: product.base_price,
          usage_based: product.usage_based,
          features: (product.features as string[]) || [],
          limits: (product.limits as Record<string, any>) || {},
          extended_documentation: product.extended_documentation || "",
          created_at: product.created_at.toISOString(),
          updated_at: product.updated_at.toISOString(),
        },
        license,
        pricing_tier: {
          id: `${product.id}-${license_type}`,
          product_id: product.id,
          tier_name: license_type,
          display_name: license_type
            .replace("_", "+")
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
          description: `${pricingConfig.features.join(", ")}`,
          monthly_price: pricingConfig.monthly_price,
          annual_price: pricingConfig.annual_price,
          max_queries: pricingConfig.max_queries ?? undefined,
          max_sites: pricingConfig.max_sites,
          agent_api_access: pricingConfig.agent_api_access,
          extra_site_price: license_type === "enterprise" ? 15 : undefined,
          overage_price: license_type !== "enterprise" ? 0.5 : undefined,
          custom_embedding_markup: 15,
          features: pricingConfig.features,
          is_active: true,
          sort_order: Object.keys(PRICING_CONFIG).indexOf(license_type),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
      message: `Successfully purchased ${product.name} (${license_type})! Your license key is ${license.license_key}`,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Error simulating purchase:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process purchase",
    });
  }
};

/**
 * GET /api/purchases/available
 * Get available products for purchase with pricing tiers
 */
export const getAvailableProducts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    // Get all active ecosystem products
    const products = await prisma.ecosystemProduct.findMany({
      where: { is_active: true },
      include: {
        plugins: {
          where: { is_active: true },
          orderBy: { version: "desc" },
          take: 1, // Get only the latest version
        },
        licenses: {
          where: { user_id: req.user.id },
          take: 1,
        },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    // Map products to response format with pricing tiers
    const availableProducts: AvailableProductResponse[] = products.map(
      (product: any) => {
        const userLicense = product.licenses[0];

        // Generate pricing tiers for each product
        const pricing_tiers = Object.entries(PRICING_CONFIG).map(
          ([tierName, config]) => ({
            id: `${product.id}-${tierName}`,
            product_id: product.id,
            tier_name: tierName,
            display_name: tierName
              .replace("_", "+")
              .split(" ")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" "),
            description: config.features.join(", "),
            monthly_price: config.monthly_price,
            annual_price: config.annual_price,
            max_queries: config.max_queries ?? undefined,
            max_sites: config.max_sites,
            agent_api_access: config.agent_api_access,
            extra_site_price: tierName === "enterprise" ? 15 : undefined,
            overage_price: tierName !== "enterprise" ? 0.5 : undefined,
            custom_embedding_markup: 15,
            features: config.features,
            is_active: true,
            sort_order: Object.keys(PRICING_CONFIG).indexOf(tierName),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        );

        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          category: product.category,
          features: (product.features as string[]) || [],
          pricing_tiers,
          has_license: !!userLicense,
          license_status: userLicense?.status,
          current_tier: userLicense?.license_type,
        };
      }
    );

    res.json({
      success: true,
      products: availableProducts,
      total: availableProducts.length,
    });
  } catch (error) {
    console.error("Error getting available products:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get available products",
    });
  }
};

/**
 * GET /api/purchases/user/history
 * Get user's purchase history
 */
export const getPurchaseHistory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const [licenses, total] = await Promise.all([
      prisma.license.findMany({
        where: { user_id: req.user.id },
        include: {
          product: true,
        },
        orderBy: { created_at: "desc" },
        skip: offset,
        take: limitNum,
      }),
      prisma.license.count({ where: { user_id: req.user.id } }),
    ]);

    const purchaseHistory: PurchaseHistoryItem[] = licenses.map(
      (license: any) => ({
        purchase_reference: license.purchase_reference || `REF_${license.id}`,
        product_name: license.product.name,
        license_type: license.license_type as LicenseType,
        billing_period: license.billing_period as BillingPeriod,
        amount_paid: license.amount_paid || 0,
        purchased_at: license.created_at.toISOString(),
        license: {
          id: license.id,
          user_id: license.user_id,
          product_id: license.product_id,
          license_key: license.license_key,
          license_type: license.license_type as LicenseType,
          status: license.status,
          is_active: license.is_active,
          billing_period: license.billing_period as BillingPeriod,
          amount_paid: license.amount_paid,
          currency: license.currency,
          issued_at: license.issued_at.toISOString(),
          expires_at: license.expires_at?.toISOString(),
          last_validated: license.last_validated?.toISOString(),
          agent_api_access: license.agent_api_access,
          max_sites: license.max_sites,
          download_count: license.download_count,
          max_downloads: license.max_downloads,
          query_count: license.query_count,
          max_queries: license.max_queries,
          query_period_start: license.query_period_start.toISOString(),
          query_period_end: license.query_period_end?.toISOString(),
          additional_sites: license.additional_sites,
          custom_embedding: license.custom_embedding,
          purchase_reference: license.purchase_reference,
          notes: license.notes,
          metadata: license.metadata || {},
          created_at: license.created_at.toISOString(),
          updated_at: license.updated_at.toISOString(),
          product: {
            id: license.product.id,
            name: license.product.name,
            slug: license.product.slug,
            description: license.product.description,
            category: license.product.category,
            version: license.product.version,
            is_active: license.product.is_active,
            is_beta: license.product.is_beta,
            base_price: license.product.base_price,
            usage_based: license.product.usage_based,
            features: (license.product.features as string[]) || [],
            limits: (license.product.limits as Record<string, any>) || {},
            extended_documentation:
              license.product.extended_documentation || "",
            created_at: license.product.created_at.toISOString(),
            updated_at: license.product.updated_at.toISOString(),
          },
        },
      })
    );

    res.json({
      success: true,
      purchases: purchaseHistory,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error getting purchase history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get purchase history",
    });
  }
};

/**
 * POST /api/purchases/admin/gift
 * Admin endpoint to gift a license to a user
 */
export const giftLicense = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      user_id,
      product_slug,
      license_type = "standard",
      billing_period = "monthly",
      additional_sites = 0,
      custom_embedding = false,
      notes,
    }: GiftLicenseRequest = req.body;

    if (!user_id || !product_slug) {
      res.status(400).json({
        success: false,
        error: "User ID and product slug are required",
      });
      return;
    }

    // Validate license type
    if (!PRICING_CONFIG[license_type as LicenseType]) {
      res.status(400).json({
        success: false,
        error: "Invalid license type",
      });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: user_id },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: "User not found",
      });
      return;
    }

    // Find the ecosystem product
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

    // Check if user already has a license
    const existingLicense = await prisma.license.findUnique({
      where: {
        user_id_product_id: {
          user_id,
          product_id: product.id,
        },
      },
    });

    if (existingLicense) {
      res.status(400).json({
        success: false,
        error: "User already has a license for this product",
      });
      return;
    }

    // Create the license
    const license = await createLicense({
      user_id,
      product_slug,
      license_type: license_type as LicenseType,
      billing_period: billing_period as BillingPeriod,
      additional_sites,
      custom_embedding,
      purchase_reference: `GIFT_${Date.now()}`,
      notes: notes || "License gifted by admin",
      metadata: {
        gifted: true,
        gift_date: new Date().toISOString(),
        gifted_by_admin: true,
      },
    });

    // Log gift activity
    try {
      await logActivityWithRequest(
        req,
        user_id,
        ACTIVITY_TYPES.PRODUCT_REGISTERED,
        `Received gifted product: ${product.name}`,
        {
          description: `Admin gifted ${product.name} (${license_type}) to ${user.name} (${user.email})`,
          metadata: {
            product_id: product.id,
            product_slug: product.slug,
            license_id: license.id,
            license_key: license.license_key,
            license_type,
            billing_period,
            gifted: true,
          },
        }
      );
    } catch (activityError) {
      console.error("Failed to log gift activity:", activityError);
    }

    res.status(201).json({
      success: true,
      license,
      message: `Successfully gifted ${product.name} (${license_type}) to ${user.name}`,
    });
  } catch (error) {
    console.error("Error gifting license:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to gift license",
    });
  }
};
