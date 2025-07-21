/**
 * License Service
 * Handles license generation, validation, and management for products with tiered pricing
 */

import { prisma } from "../config/database";
import {
  License,
  LicenseType,
  LicenseStatus,
  BillingPeriod,
  CreateLicenseRequest,
} from "../types";
import { PRICING_CONFIG, ADD_ON_PRICING } from "../config/pricing";

/**
 * Generate a secure license key
 */
const generateLicenseKey = (): string => {
  // Generate 4 groups of 4 characters each (XXXX-XXXX-XXXX-XXXX)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  
  for (let group = 0; group < 4; group++) {
    if (group > 0) result += "-";
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  
  return result;
};

/**
 * Calculate expiration date based on billing period
 */
const calculateExpirationDate = (billingPeriod: BillingPeriod): Date | null => {
  const now = new Date();
  
  switch (billingPeriod) {
    case "monthly":
      const monthlyExpiry = new Date(now);
      monthlyExpiry.setMonth(monthlyExpiry.getMonth() + 1);
      return monthlyExpiry;
    case "annual":
      const annualExpiry = new Date(now);
      annualExpiry.setFullYear(annualExpiry.getFullYear() + 1);
      return annualExpiry;
    default:
      return null; // No expiration for other types
  }
};

/**
 * Get a license by ID
 */
export const getLicenseById = async (licenseId: string): Promise<License | null> => {
  const license = await prisma.license.findUnique({
    where: { id: licenseId },
    include: {
      product: true,
      user: true,
    },
  });

  if (!license) return null;

  return mapPrismaLicenseToLicense(license);
};

/**
 * Get licenses for a product
 */
export const getProductLicenses = async (productSlug: string): Promise<License[]> => {
  try {
    const licenses = await prisma.license.findMany({
      where: {
        product: {
          slug: productSlug,
        },
      },
      include: {
        user: true,
        product: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return licenses.map(mapPrismaLicenseToLicense);
  } catch (error) {
    console.error("Error getting product licenses:", error);
    throw error;
  }
};

/**
 * Validate a license for a product
 */
export const validateLicense = async (
  licenseKey: string,
  productSlug: string
): Promise<License | null> => {
  try {
    const license = await prisma.license.findFirst({
      where: {
        license_key: licenseKey,
        product: {
          slug: productSlug,
        },
        status: "active",
        is_active: true,
      },
      include: {
        user: true,
        product: true,
      },
    });

    if (!license) {
      return null;
    }

    // Check if license is expired
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return null;
    }

    return mapPrismaLicenseToLicense(license);
  } catch (error) {
    console.error("Error validating license:", error);
    throw error;
  }
};

/**
 * Increment the download count for a license
 */
export const incrementDownloadCount = async (licenseId: string): Promise<void> => {
  try {
    await prisma.license.update({
      where: { id: licenseId },
      data: {
        download_count: {
          increment: 1
        }
      }
    });
  } catch (error) {
    console.error(`Error incrementing download count for license ${licenseId}:`, error);
    throw error;
  }
};

/**
 * Create a new license
 */
export const createLicense = async (request: CreateLicenseRequest): Promise<License> => {
  try {
    // Validate license type
    if (!PRICING_CONFIG[request.license_type]) {
      throw new Error(`Invalid license type: ${request.license_type}`);
    }

    // Find the product by slug
    const product = await prisma.product.findUnique({
      where: { slug: request.product_slug },
    });

    if (!product) {
      throw new Error(`Product not found: ${request.product_slug}`);
    }

    if (!product.is_active) {
      throw new Error(`Product is not active: ${request.product_slug}`);
    }

    // Check if user already has a license for this product
    const existingLicense = await prisma.license.findUnique({
      where: {
        user_id_product_id: {
          user_id: request.user_id,
          product_id: product.id,
        },
      },
    });

    if (existingLicense) {
      throw new Error(`User already has a license for product: ${request.product_slug}`);
    }

    // Generate unique license key
    let licenseKey: string;
    let isUnique = false;
    do {
      licenseKey = generateLicenseKey();
      const existingKey = await prisma.license.findUnique({
        where: { license_key: licenseKey },
      });
      isUnique = !existingKey;
    } while (!isUnique);

    // Get pricing configuration
    const pricingConfig = PRICING_CONFIG[request.license_type];
    const billingPeriod = request.billing_period || "monthly";
    
    // Calculate pricing
    const basePrice = billingPeriod === "annual" 
      ? pricingConfig.annual_price 
      : pricingConfig.monthly_price;
    
    const extraSitesCost = (request.additional_sites || 0) * ADD_ON_PRICING.extra_site_price;
    const customEmbeddingCost = request.custom_embedding 
      ? basePrice * (ADD_ON_PRICING.custom_embedding_markup / 100) 
      : 0;
    const totalPrice = basePrice + extraSitesCost + customEmbeddingCost;

    // Calculate expiration date
    const expiresAt = calculateExpirationDate(billingPeriod);
    
    // Calculate query period end
    const queryPeriodEnd = calculateExpirationDate(billingPeriod);

    // Create license in database - strictly following Prisma schema
    const prismaLicense = await prisma.license.create({
      data: {
        user_id: request.user_id,
        product_id: product.id,
        license_key: licenseKey,
        license_type: request.license_type, // Schema: String @default("standard")
        status: "active", // Schema: String @default("active") 
        is_active: true, // Schema: Boolean @default(true)
        billing_period: billingPeriod, // Schema: String @default("monthly")
        amount_paid: totalPrice, // Schema: Float?
        currency: "usd", // Schema: String @default("usd")
        issued_at: new Date(), // Schema: DateTime @default(now())
        expires_at: expiresAt, // Schema: DateTime?
        agent_api_access: pricingConfig.agent_api_access, // Schema: Boolean @default(false)
        max_sites: pricingConfig.max_sites + (request.additional_sites || 0), // Schema: Int @default(1)
        download_count: 0, // Schema: Int @default(0) - let Prisma handle default
        max_downloads: request.max_downloads || product.max_downloads || null, // Schema: Int?
        query_count: 0, // Schema: Int @default(0) - let Prisma handle default
        max_queries: request.max_queries || pricingConfig.max_queries || null, // Schema: Int?
        query_period_start: new Date(), // Schema: DateTime @default(now())
        query_period_end: queryPeriodEnd, // Schema: DateTime?
        additional_sites: request.additional_sites || 0, // Schema: Int @default(0)
        custom_embedding: request.custom_embedding || false, // Schema: Boolean @default(false)
        purchase_reference: request.purchase_reference || null, // Schema: String?
        notes: request.notes || null, // Schema: String?
        metadata: request.metadata || {}, // Schema: Json?
      },
      include: {
        user: true,
        product: true,
      },
    });

    return mapPrismaLicenseToLicense(prismaLicense);
  } catch (error) {
    console.error("Error creating license:", error);
    throw error;
  }
};

/**
 * Update a license
 */
export const updateLicense = async (licenseId: string, updates: any): Promise<License> => {
  try {
    // Find the existing license
    const existingLicense = await prisma.license.findUnique({
      where: { id: licenseId },
      include: {
        user: true,
        product: true,
      },
    });

    if (!existingLicense) {
      throw new Error(`License not found: ${licenseId}`);
    }

    // Build update data, filtering out undefined values
    const updateData: any = {};
    
    if (updates.license_type !== undefined) updateData.license_type = updates.license_type;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.billing_period !== undefined) updateData.billing_period = updates.billing_period;
    if (updates.expires_at !== undefined) updateData.expires_at = new Date(updates.expires_at);
    if (updates.max_downloads !== undefined) updateData.max_downloads = updates.max_downloads;
    if (updates.max_queries !== undefined) updateData.max_queries = updates.max_queries;
    if (updates.agent_api_access !== undefined) updateData.agent_api_access = updates.agent_api_access;
    if (updates.max_sites !== undefined) updateData.max_sites = updates.max_sites;
    if (updates.additional_sites !== undefined) updateData.additional_sites = updates.additional_sites;
    if (updates.custom_embedding !== undefined) updateData.custom_embedding = updates.custom_embedding;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    // Update the license
    const updatedLicense = await prisma.license.update({
      where: { id: licenseId },
      data: updateData,
      include: {
        user: true,
        product: true,
      },
    });

    return mapPrismaLicenseToLicense(updatedLicense);
  } catch (error) {
    console.error("Error updating license:", error);
    throw error;
  }
};

/**
 * Revoke a license
 */
export const revokeLicense = async (licenseId: string): Promise<License> => {
  try {
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
  } catch (error) {
    console.error("Error revoking license:", error);
    throw error;
  }
};

/**
 * Get user licenses with filters
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
 * Get user license stats
 */
export const getUserLicenseStats = async (userId: string): Promise<any> => {
  try {
    const licenses = await prisma.license.findMany({
      where: { user_id: userId },
      include: {
        product: true,
      },
    });

    const stats = {
      total_licenses: licenses.length,
      active_licenses: licenses.filter((l: any) => l.status === "active").length,
      expired_licenses: licenses.filter((l: any) => l.status === "expired").length,
      revoked_licenses: licenses.filter((l: any) => l.status === "revoked").length,
      suspended_licenses: licenses.filter((l: any) => l.status === "suspended").length,
      downloads_used: licenses.reduce((sum: number, l: any) => sum + l.download_count, 0),
      downloads_remaining: licenses.reduce((sum: number, l: any) => {
        if (!l.max_downloads) return sum;
        return sum + Math.max(0, l.max_downloads - l.download_count);
      }, 0),
      queries_used: licenses.reduce((sum: number, l: any) => sum + l.query_count, 0),
      queries_remaining: licenses.reduce((sum: number, l: any) => {
        if (!l.max_queries) return sum;
        return sum + Math.max(0, l.max_queries - l.query_count);
      }, 0),
      licenses_by_type: licenses.reduce((acc: Record<string, number>, l: any) => {
        acc[l.license_type] = (acc[l.license_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      licenses_by_status: licenses.reduce((acc: Record<string, number>, l: any) => {
        acc[l.status] = (acc[l.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return stats;
  } catch (error) {
    console.error("Error getting user license stats:", error);
    throw error;
  }
};

/**
 * Update expired licenses
 */
export const updateExpiredLicenses = async (): Promise<number> => {
  try {
    const now = new Date();
    
    const result = await prisma.license.updateMany({
      where: {
        expires_at: {
          lt: now,
        },
        status: "active",
      },
      data: {
        status: "expired",
        is_active: false,
      },
    });

    console.log(`Updated ${result.count} expired licenses`);
    return result.count;
  } catch (error) {
    console.error("Error updating expired licenses:", error);
    throw error;
  }
};

/**
 * Track query usage
 */
export const trackQueryUsage = async (licenseId: string, request: any): Promise<void> => {
  try {
    // Get the license
    const license = await prisma.license.findUnique({
      where: { id: licenseId },
    });

    if (!license) {
      throw new Error(`License not found: ${licenseId}`);
    }

    // Create query usage record
    await prisma.queryUsage.create({
      data: {
        user_id: license.user_id,
        license_id: licenseId,
        site_id: request.site_id || undefined,
        query_type: request.query_type || "search",
        endpoint: request.endpoint || "/api/search",
        query_text: request.query_text || undefined,
        ip_address: request.ip_address || undefined,
        user_agent: request.user_agent || undefined,
        is_agent_request: request.is_agent_request || false,
        response_time_ms: request.response_time_ms || undefined,
        results_count: request.results_count || undefined,
        billable: request.billable !== false, // Default to true
      },
    });

    // Increment query count on license if billable
    if (request.billable !== false) {
      await prisma.license.update({
        where: { id: licenseId },
        data: {
          query_count: {
            increment: 1,
          },
        },
      });
    }
  } catch (error) {
    console.error("Error tracking query usage:", error);
    throw error;
  }
};

/**
 * Get license usage
 */
export const getLicenseUsage = async (licenseId: string): Promise<any> => {
  try {
    const license = await prisma.license.findUnique({
      where: { id: licenseId },
      include: {
        query_usage: {
          orderBy: {
            created_at: "desc",
          },
          take: 100, // Last 100 queries
        },
      },
    });

    if (!license) {
      throw new Error(`License not found: ${licenseId}`);
    }

    const usage = {
      queries_used: license.query_count,
      queries_remaining: license.max_queries ? Math.max(0, license.max_queries - license.query_count) : null,
      query_period_start: license.query_period_start.toISOString(),
      query_period_end: license.query_period_end?.toISOString() || null,
      downloads_used: license.download_count,
      downloads_remaining: license.max_downloads ? Math.max(0, license.max_downloads - license.download_count) : null,
      sites_used: license.additional_sites + 1, // Base site + additional
      sites_remaining: Math.max(0, license.max_sites - (license.additional_sites + 1)),
      agent_access_enabled: license.agent_api_access,
      custom_embedding_enabled: license.custom_embedding,
      recent_queries: license.query_usage,
    };

    return usage;
  } catch (error) {
    console.error("Error getting license usage:", error);
    throw error;
  }
};

// Helper function to map Prisma license to License interface
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
    user: prismaLicense.user ? {
      id: prismaLicense.user.id,
      email: prismaLicense.user.email,
      name: prismaLicense.user.name,
      created_at: prismaLicense.user.created_at.toISOString(),
      updated_at: prismaLicense.user.updated_at.toISOString(),
      is_active: prismaLicense.user.is_active,
      subscription_tier: prismaLicense.user.subscription_tier,
    } : undefined,
    product: prismaLicense.product ? {
      id: prismaLicense.product.id,
      name: prismaLicense.product.name,
      slug: prismaLicense.product.slug,
      description: prismaLicense.product.description,
      category: prismaLicense.product.category,
      version: prismaLicense.product.version,
      is_active: prismaLicense.product.is_active,
      is_beta: prismaLicense.product.is_beta,
      base_price: prismaLicense.product.base_price ?? undefined,
      usage_based: prismaLicense.product.usage_based,
      features: (prismaLicense.product.features as string[]) || [],
      limits: (prismaLicense.product.limits as Record<string, any>) || {},
      extended_documentation: prismaLicense.product.extended_documentation || "",
      filename: prismaLicense.product.filename || undefined,
      file_path: prismaLicense.product.file_path || undefined,
      file_size: prismaLicense.product.file_size || undefined,
      file_hash: prismaLicense.product.file_hash || undefined,
      content_type: prismaLicense.product.content_type || undefined,
      is_public: prismaLicense.product.is_public,
      release_notes: prismaLicense.product.release_notes || undefined,
      changelog: prismaLicense.product.changelog || undefined,
      max_downloads: prismaLicense.product.max_downloads || undefined,
      created_at: prismaLicense.product.created_at.toISOString(),
      updated_at: prismaLicense.product.updated_at.toISOString(),
    } : undefined,
  };
};
