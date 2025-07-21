/**
 * License Service
 * Handles license generation, validation, and management for products with tiered pricing
 */

import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import {
  License,
  CreateLicenseRequest,
  UpdateLicenseRequest,
  ValidateLicenseRequest,
  ValidateLicenseResponse,
  LicenseStatus,
  LicenseType,
  BillingPeriod,
  UserLicenseStats,
  QueryTrackingRequest,
  LicenseUsageResponse,
  PricingTier,
} from "../types";

const prisma = new PrismaClient();

/**
 * Pricing tier configurations
 */
const TIER_CONFIGS: Record<
  LicenseType,
  {
    max_queries: number | null;
    max_sites: number;
    agent_api_access: boolean;
    base_monthly_price: number;
    base_annual_price: number;
  }
> = {
  trial: {
    max_queries: 50,
    max_sites: 1,
    agent_api_access: false,
    base_monthly_price: 0,
    base_annual_price: 0,
  },
  standard: {
    max_queries: 100,
    max_sites: 1,
    agent_api_access: false,
    base_monthly_price: 19,
    base_annual_price: 205,
  },
  standard_plus: {
    max_queries: 100,
    max_sites: 1,
    agent_api_access: true,
    base_monthly_price: 24,
    base_annual_price: 259,
  },
  premium: {
    max_queries: 2000,
    max_sites: 1,
    agent_api_access: false,
    base_monthly_price: 49,
    base_annual_price: 529,
  },
  premium_plus: {
    max_queries: 2000,
    max_sites: 1,
    agent_api_access: true,
    base_monthly_price: 59,
    base_annual_price: 637,
  },
  enterprise: {
    max_queries: null, // unlimited
    max_sites: 10,
    agent_api_access: true,
    base_monthly_price: 199,
    base_annual_price: 2149,
  },
};

/**
 * Generate a secure license key
 * Format: XXXX-XXXX-XXXX-XXXX (16 character alphanumeric)
 */
const generateLicenseKey = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segments = [];

  for (let i = 0; i < 4; i++) {
    let segment = "";
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }

  return segments.join("-");
};

/**
 * Generate a unique license key (ensures no duplicates)
 */
const generateUniqueLicenseKey = async (): Promise<string> => {
  let licenseKey: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    licenseKey = generateLicenseKey();

    const existingLicense = await prisma.license.findUnique({
      where: { license_key: licenseKey },
    });

    if (!existingLicense) {
      isUnique = true;
      return licenseKey;
    }

    attempts++;
  }

  throw new Error(
    "Failed to generate unique license key after maximum attempts"
  );
};

/**
 * Calculate license expiration date based on type and billing period
 */
const calculateExpirationDate = (
  licenseType: LicenseType,
  billingPeriod: BillingPeriod
): Date | null => {
  if (licenseType === "trial") {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 30); // 30 days
    return expiration;
  }

  if (licenseType === "enterprise") {
    // Enterprise licenses can be set to not expire by default
    return null;
  }

  const expiration = new Date();
  if (billingPeriod === "annual") {
    expiration.setFullYear(expiration.getFullYear() + 1);
  } else {
    expiration.setMonth(expiration.getMonth() + 1);
  }

  return expiration;
};

/**
 * Calculate query period end date
 */
const calculateQueryPeriodEnd = (billingPeriod: BillingPeriod): Date => {
  const end = new Date();
  if (billingPeriod === "annual") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
};

/**
 * Create a new license for a user and product
 */
export const createLicense = async (
  request: CreateLicenseRequest
): Promise<License> => {
  const {
    user_id,
    product_slug,
    license_type = "standard",
    billing_period = "monthly",
    max_downloads,
    max_queries,
    additional_sites = 0,
    custom_embedding = false,
    purchase_reference,
    notes,
    metadata,
  } = request;

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: user_id },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Verify product exists
  const product = await prisma.ecosystemProduct.findUnique({
    where: { slug: product_slug },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  if (!product.is_active) {
    throw new Error("Product is not active");
  }

  // Check if license already exists for this user and product
  const existingLicense = await prisma.license.findUnique({
    where: {
      user_id_product_id: {
        user_id,
        product_id: product.id,
      },
    },
  });

  if (existingLicense) {
    throw new Error("License already exists for this user and product");
  }

  // Get tier configuration
  const tierConfig = TIER_CONFIGS[license_type];
  if (!tierConfig) {
    throw new Error(`Invalid license type: ${license_type}`);
  }

  // Generate unique license key
  const licenseKey = await generateUniqueLicenseKey();

  // Calculate dates
  const expirationDate = calculateExpirationDate(license_type, billing_period);
  const queryPeriodEnd = calculateQueryPeriodEnd(billing_period);

  // Calculate pricing
  const basePrice =
    billing_period === "annual"
      ? tierConfig.base_annual_price
      : tierConfig.base_monthly_price;

  const extraSitesCost = additional_sites * 15; // $15 per extra site
  const customEmbeddingCost = custom_embedding ? basePrice * 0.15 : 0; // 15% markup
  const totalPrice = basePrice + extraSitesCost + customEmbeddingCost;

  // Create the license
  const prismaLicense = await prisma.license.create({
    data: {
      user_id,
      product_id: product.id,
      license_key: licenseKey,
      license_type,
      status: "active",
      is_active: true,
      billing_period,
      amount_paid: totalPrice,
      currency: "usd",
      issued_at: new Date(),
      expires_at: expirationDate,
      agent_api_access: tierConfig.agent_api_access,
      max_sites: tierConfig.max_sites + additional_sites,
      download_count: 0,
      max_downloads,
      query_count: 0,
      max_queries: max_queries || (tierConfig.max_queries ?? undefined),
      query_period_start: new Date(),
      query_period_end: queryPeriodEnd,
      additional_sites,
      custom_embedding,
      purchase_reference,
      notes,
      metadata: metadata || {},
    },
    include: {
      user: true,
      product: true,
    },
  });

  return mapPrismaLicenseToLicense(prismaLicense);
};

/**
 * Validate a license key and return license information
 */
export const validateLicense = async (
  request: ValidateLicenseRequest
): Promise<ValidateLicenseResponse> => {
  const {
    license_key,
    product_slug,
    check_agent_access = false,
    site_id,
  } = request;

  const license = await prisma.license.findUnique({
    where: { license_key },
    include: {
      user: true,
      product: true,
    },
  });

  if (!license) {
    return {
      valid: false,
      message: "License key not found",
      download_allowed: false,
      query_allowed: false,
      agent_access_allowed: false,
    };
  }

  // Check if license is for the correct product (if product_slug provided)
  if (product_slug && license.product.slug !== product_slug) {
    return {
      valid: false,
      message: "License key is not valid for this product",
      download_allowed: false,
      query_allowed: false,
      agent_access_allowed: false,
    };
  }

  // Check if license is active
  if (!license.is_active || license.status !== "active") {
    return {
      valid: false,
      license: mapPrismaLicenseToLicense(license),
      message: `License is ${license.status}`,
      download_allowed: false,
      query_allowed: false,
      agent_access_allowed: false,
    };
  }

  // Check if license has expired
  if (license.expires_at && new Date() > license.expires_at) {
    // Update license status to expired
    await prisma.license.update({
      where: { id: license.id },
      data: { status: "expired" },
    });

    return {
      valid: false,
      license: mapPrismaLicenseToLicense(license),
      message: "License has expired",
      download_allowed: false,
      query_allowed: false,
      agent_access_allowed: false,
    };
  }

  // Check query limits
  const queryAllowed = checkQueryLimit(license);
  const queriesRemaining = license.max_queries
    ? Math.max(0, license.max_queries - license.query_count)
    : undefined;

  // Check agent access
  const agentAccessAllowed = !check_agent_access || license.agent_api_access;

  // Check site limits (if site_id provided)
  // This would require tracking which sites a license is used for
  // For now, we'll just check the max_sites limit
  const sitesRemaining = Math.max(0, license.max_sites);

  // Update last_validated
  await prisma.license.update({
    where: { id: license.id },
    data: { last_validated: new Date() },
  });

  return {
    valid: true,
    license: mapPrismaLicenseToLicense(license),
    message: "License is valid",
    download_allowed: true,
    query_allowed: queryAllowed,
    agent_access_allowed: agentAccessAllowed,
    queries_remaining: queriesRemaining,
    sites_remaining: sitesRemaining,
  };
};

/**
 * Check if a license is within query limits
 */
const checkQueryLimit = (license: any): boolean => {
  // If no query limit (unlimited), allow all queries
  if (!license.max_queries) {
    return true;
  }

  // Check if we're within the current billing period
  const now = new Date();
  if (license.query_period_end && now > license.query_period_end) {
    // Period has ended - reset query count (this should be done by a background job)
    return true;
  }

  // Check if within limits
  return license.query_count < license.max_queries;
};

/**
 * Track query usage for a license
 */
export const trackQueryUsage = async (
  licenseId: string,
  request: QueryTrackingRequest
): Promise<void> => {
  const {
    query_type,
    endpoint,
    query_text,
    site_id,
    is_agent_request = false,
    response_time_ms,
    results_count,
  } = request;

  const license = await prisma.license.findUnique({
    where: { id: licenseId },
  });

  if (!license) {
    throw new Error("License not found");
  }

  // Create query usage record
  await prisma.queryUsage.create({
    data: {
      user_id: license.user_id,
      license_id: licenseId,
      site_id,
      query_type,
      endpoint,
      query_text,
      is_agent_request,
      response_time_ms,
      results_count,
      billable: true, // Could be configurable based on query type
    },
  });

  // Update license query count if billable
  await prisma.license.update({
    where: { id: licenseId },
    data: {
      query_count: {
        increment: 1,
      },
    },
  });
};

/**
 * Reset query counts for licenses at the start of new billing periods
 * Should be run as a background job
 */
export const resetQueryCounts = async (): Promise<number> => {
  const now = new Date();

  // Find licenses whose query period has ended
  const expiredPeriods = await prisma.license.findMany({
    where: {
      query_period_end: {
        lt: now,
      },
      status: "active",
    },
  });

  let resetCount = 0;

  for (const license of expiredPeriods) {
    const newPeriodEnd = calculateQueryPeriodEnd(
      license.billing_period as BillingPeriod
    );

    await prisma.license.update({
      where: { id: license.id },
      data: {
        query_count: 0,
        query_period_start: now,
        query_period_end: newPeriodEnd,
      },
    });

    resetCount++;
  }

  return resetCount;
};

/**
 * Get license usage information
 */
export const getLicenseUsage = async (
  licenseId: string
): Promise<LicenseUsageResponse> => {
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    include: {
      query_usage: {
        where: {
          created_at: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      },
    },
  });

  if (!license) {
    throw new Error("License not found");
  }

  // Get sites used (count unique site_ids from query usage)
  const sitesUsedCount = await prisma.queryUsage.groupBy({
    by: ["site_id"],
    where: {
      license_id: licenseId,
      site_id: {
        not: null,
      },
    },
  });

  return {
    queries_used: license.query_count,
    queries_remaining: license.max_queries
      ? Math.max(0, license.max_queries - license.query_count)
      : undefined,
    query_period_start: license.query_period_start.toISOString(),
    query_period_end: license.query_period_end?.toISOString(),
    downloads_used: license.download_count,
    downloads_remaining: license.max_downloads
      ? Math.max(0, license.max_downloads - license.download_count)
      : undefined,
    sites_used: sitesUsedCount.length,
    sites_remaining: Math.max(0, license.max_sites - sitesUsedCount.length),
    agent_access_enabled: license.agent_api_access,
    custom_embedding_enabled: license.custom_embedding,
  };
};

/**
 * Get licenses for a user with optional filtering
 */
export const getUserLicenses = async (
  userId: string,
  filters?: {
    status?: LicenseStatus;
    product_slug?: string;
  }
): Promise<License[]> => {
  const where: any = { user_id: userId };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.product_slug) {
    where.product = {
      slug: filters.product_slug,
    };
  }

  const licenses = await prisma.license.findMany({
    where,
    include: {
      user: true,
      product: true,
    },
    orderBy: {
      created_at: "desc",
    },
  });

  return licenses.map(mapPrismaLicenseToLicense);
};

/**
 * Update a license
 */
export const updateLicense = async (
  licenseId: string,
  request: UpdateLicenseRequest
): Promise<License> => {
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
  });

  if (!license) {
    throw new Error("License not found");
  }

  // Calculate new pricing if tier or add-ons changed
  let amount_paid = license.amount_paid;
  if (
    request.license_type ||
    request.billing_period ||
    request.additional_sites !== undefined ||
    request.custom_embedding !== undefined
  ) {
    const licenseType =
      request.license_type || (license.license_type as LicenseType);
    const billingPeriod =
      request.billing_period || (license.billing_period as BillingPeriod);
    const additionalSites =
      request.additional_sites ?? license.additional_sites;
    const customEmbedding =
      request.custom_embedding ?? license.custom_embedding;

    const tierConfig = TIER_CONFIGS[licenseType];
    const basePrice =
      billingPeriod === "annual"
        ? tierConfig.base_annual_price
        : tierConfig.base_monthly_price;

    const extraSitesCost = additionalSites * 15;
    const customEmbeddingCost = customEmbedding ? basePrice * 0.15 : 0;
    amount_paid = basePrice + extraSitesCost + customEmbeddingCost;
  }

  // Update license
  const updatedLicense = await prisma.license.update({
    where: { id: licenseId },
    data: {
      ...request,
      amount_paid,
      // Update max_sites if license_type changed
      max_sites: request.license_type
        ? TIER_CONFIGS[request.license_type].max_sites +
          (request.additional_sites ?? license.additional_sites)
        : undefined,
      // Update agent_api_access if license_type changed
      agent_api_access: request.license_type
        ? TIER_CONFIGS[request.license_type].agent_api_access
        : undefined,
      // Update max_queries if license_type changed
      max_queries: request.license_type
        ? request.max_queries ??
          (TIER_CONFIGS[request.license_type].max_queries || undefined)
        : request.max_queries,
    },
    include: {
      user: true,
      product: true,
    },
  });

  return mapPrismaLicenseToLicense(updatedLicense);
};

/**
 * Revoke a license
 */
export const revokeLicense = async (licenseId: string): Promise<License> => {
  const revokedLicense = await prisma.license.update({
    where: { id: licenseId },
    data: {
      status: "revoked",
      is_active: false,
    },
    include: {
      user: true,
      product: true,
    },
  });

  return mapPrismaLicenseToLicense(revokedLicense);
};

/**
 * Check and update expired licenses
 * Should be run periodically as a background job
 */
export const updateExpiredLicenses = async (): Promise<number> => {
  const result = await prisma.license.updateMany({
    where: {
      expires_at: {
        lt: new Date(),
      },
      status: "active",
    },
    data: {
      status: "expired",
    },
  });

  return result.count;
};

/**
 * Get license statistics for a user
 */
export const getUserLicenseStats = async (
  userId: string
): Promise<UserLicenseStats> => {
  const licenses = await prisma.license.findMany({
    where: { user_id: userId },
  });

  const stats: UserLicenseStats = {
    total_licenses: licenses.length,
    active_licenses: licenses.filter((l: any) => l.status === "active").length,
    expired_licenses: licenses.filter((l: any) => l.status === "expired")
      .length,
    downloads_used: licenses.reduce(
      (sum: number, l: any) => sum + l.download_count,
      0
    ),
    downloads_remaining: licenses
      .filter((l: any) => l.status === "active" && l.max_downloads)
      .reduce(
        (sum: number, l: any) =>
          sum + Math.max(0, l.max_downloads - l.download_count),
        0
      ),
    queries_used: licenses.reduce(
      (sum: number, l: any) => sum + l.query_count,
      0
    ),
    queries_remaining: licenses
      .filter((l: any) => l.status === "active" && l.max_queries)
      .reduce(
        (sum: number, l: any) =>
          sum + Math.max(0, l.max_queries - l.query_count),
        0
      ),
    licenses_by_type: {
      trial: 0,
      standard: 0,
      standard_plus: 0,
      premium: 0,
      premium_plus: 0,
      enterprise: 0,
    },
    licenses_by_status: {
      active: 0,
      expired: 0,
      revoked: 0,
      suspended: 0,
    },
  };

  // Count licenses by type and status
  licenses.forEach((license: any) => {
    const type = license.license_type as LicenseType;
    const status = license.status as LicenseStatus;

    stats.licenses_by_type[type] = (stats.licenses_by_type[type] || 0) + 1;
    stats.licenses_by_status[status] =
      (stats.licenses_by_status[status] || 0) + 1;
  });

  return stats;
};

/**
 * Map Prisma license object to License interface
 */
const mapPrismaLicenseToLicense = (prismaLicense: any): License => {
  return {
    id: prismaLicense.id,
    user_id: prismaLicense.user_id,
    product_id: prismaLicense.product_id,
    license_key: prismaLicense.license_key,
    license_type: prismaLicense.license_type as LicenseType,
    status: prismaLicense.status as LicenseStatus,
    is_active: prismaLicense.is_active,
    billing_period: prismaLicense.billing_period as BillingPeriod,
    amount_paid: prismaLicense.amount_paid,
    currency: prismaLicense.currency,
    issued_at: prismaLicense.issued_at.toISOString(),
    expires_at: prismaLicense.expires_at?.toISOString(),
    last_validated: prismaLicense.last_validated?.toISOString(),
    agent_api_access: prismaLicense.agent_api_access,
    max_sites: prismaLicense.max_sites,
    download_count: prismaLicense.download_count,
    max_downloads: prismaLicense.max_downloads,
    query_count: prismaLicense.query_count,
    max_queries: prismaLicense.max_queries,
    query_period_start: prismaLicense.query_period_start.toISOString(),
    query_period_end: prismaLicense.query_period_end?.toISOString(),
    additional_sites: prismaLicense.additional_sites,
    custom_embedding: prismaLicense.custom_embedding,
    purchase_reference: prismaLicense.purchase_reference,
    notes: prismaLicense.notes,
    metadata: prismaLicense.metadata || {},
    created_at: prismaLicense.created_at.toISOString(),
    updated_at: prismaLicense.updated_at.toISOString(),
    user: prismaLicense.user
      ? {
          id: prismaLicense.user.id,
          email: prismaLicense.user.email,
          name: prismaLicense.user.name,
          created_at: prismaLicense.user.created_at.toISOString(),
          updated_at: prismaLicense.user.updated_at.toISOString(),
          is_active: prismaLicense.user.is_active,
          subscription_tier: prismaLicense.user.subscription_tier,
        }
      : undefined,
    product: prismaLicense.product
      ? {
          id: prismaLicense.product.id,
          name: prismaLicense.product.name,
          slug: prismaLicense.product.slug,
          description: prismaLicense.product.description,
          category: prismaLicense.product.category,
          version: prismaLicense.product.version,
          is_active: prismaLicense.product.is_active,
          is_beta: prismaLicense.product.is_beta,
          base_price: prismaLicense.product.base_price,
          usage_based: prismaLicense.product.usage_based,
          features: (prismaLicense.product.features as string[]) || [],
          limits: (prismaLicense.product.limits as Record<string, any>) || {},
          extended_documentation:
            prismaLicense.product.extended_documentation || "",
          created_at: prismaLicense.product.created_at.toISOString(),
          updated_at: prismaLicense.product.updated_at.toISOString(),
        }
      : undefined,
  };
};
