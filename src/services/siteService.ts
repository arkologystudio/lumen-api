import { prisma } from "../config/database";
import { Site, CreateSiteRequest, UpdateSiteRequest } from "../types/index";
import {
  initSiteCollection,
  getSiteStats,
  dropSiteCollection,
} from "./multiSiteVectorStore";

/**
 * Convert Prisma site to our Site type
 */
const mapPrismaSiteToSite = (prismaSite: any): Site => ({
  id: prismaSite.id,
  user_id: prismaSite.user_id,
  name: prismaSite.name,
  url: prismaSite.url,
  description: prismaSite.description || "",
  created_at: prismaSite.created_at.toISOString(),
  updated_at: prismaSite.updated_at.toISOString(),
  is_active: prismaSite.is_active,
  embedding_status: prismaSite.embedding_status as Site["embedding_status"],
  last_embedding_at: prismaSite.last_embedding_at?.toISOString(),
  post_count: prismaSite.post_count,
  chunk_count: prismaSite.chunk_count,
});

/**
 * Normalize URL for comparison
 */
const normalizeUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.origin.toLowerCase();
  } catch {
    throw new Error("Invalid URL format");
  }
};

/**
 * Validate site data
 */
const validateSiteData = (
  data: CreateSiteRequest | UpdateSiteRequest
): void => {
  if (data.name && (!data.name.trim() || data.name.length > 100)) {
    throw new Error("Site name must be between 1 and 100 characters");
  }

  if (data.url) {
    normalizeUrl(data.url); // This will throw if invalid
  }

  if (data.description && data.description.length > 500) {
    throw new Error("Description must be 500 characters or less");
  }
};

/**
 * Create a new site for a user
 */
export const createSite = async (
  userId: string,
  siteData: CreateSiteRequest
): Promise<Site> => {
  validateSiteData(siteData);

  const normalizedUrl = normalizeUrl(siteData.url);

  // Check if URL is already registered
  const existingSite = await prisma.site.findUnique({
    where: { url: normalizedUrl },
  });

  if (existingSite) {
    throw new Error("A site with this URL is already registered");
  }

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Create site in database
  const prismaSite = await prisma.site.create({
    data: {
      user_id: userId,
      name: siteData.name.trim(),
      url: normalizedUrl,
      description: siteData.description?.trim() || "",
      embedding_status: "not_started",
      post_count: 0,
      chunk_count: 0,
    },
  });

  const site = mapPrismaSiteToSite(prismaSite);

  // Initialize vector collection for the site
  try {
    await initSiteCollection(site.id);
    console.log(`Initialized vector collection for site: ${site.id}`);
  } catch (error) {
    console.error(
      `Failed to initialize collection for site ${site.id}:`,
      error
    );
    // Don't fail site creation if collection initialization fails
  }

  return site;
};

/**
 * Get site by ID
 */
export const getSiteById = async (siteId: string): Promise<Site | null> => {
  const prismaSite = await prisma.site.findUnique({
    where: { id: siteId },
  });

  if (!prismaSite) {
    return null;
  }

  return mapPrismaSiteToSite(prismaSite);
};

/**
 * Get site by ID with ownership verification
 */
export const getSiteByIdForUser = async (
  siteId: string,
  userId: string
): Promise<Site | null> => {
  const prismaSite = await prisma.site.findFirst({
    where: {
      id: siteId,
      user_id: userId,
    },
  });

  if (!prismaSite) {
    return null;
  }

  return mapPrismaSiteToSite(prismaSite);
};

/**
 * Get all sites for a user
 */
export const getSitesForUser = async (userId: string): Promise<Site[]> => {
  const prismaSites = await prisma.site.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
  });

  return prismaSites.map(mapPrismaSiteToSite);
};

/**
 * Update site
 */
export const updateSite = async (
  siteId: string,
  userId: string,
  updateData: UpdateSiteRequest
): Promise<Site> => {
  // Verify user owns the site
  const existingSite = await prisma.site.findFirst({
    where: {
      id: siteId,
      user_id: userId,
    },
  });

  if (!existingSite) {
    throw new Error("Site not found or access denied");
  }

  validateSiteData(updateData);

  // Check URL change if provided
  let normalizedUrl: string | undefined;
  if (updateData.url) {
    normalizedUrl = normalizeUrl(updateData.url);

    // If URL is changing, check if new URL is available
    if (normalizedUrl !== existingSite.url) {
      const urlTaken = await prisma.site.findUnique({
        where: { url: normalizedUrl },
      });

      if (urlTaken) {
        throw new Error("A site with this URL is already registered");
      }
    }
  }

  // Update site
  const updatedPrismaSite = await prisma.site.update({
    where: { id: siteId },
    data: {
      ...(updateData.name && { name: updateData.name.trim() }),
      ...(normalizedUrl && { url: normalizedUrl }),
      ...(updateData.description !== undefined && {
        description: updateData.description.trim(),
      }),
      ...(updateData.is_active !== undefined && {
        is_active: updateData.is_active,
      }),
    },
  });

  return mapPrismaSiteToSite(updatedPrismaSite);
};

/**
 * Delete site (and its vector collection)
 */
export const deleteSite = async (
  siteId: string,
  userId: string
): Promise<void> => {
  // Verify user owns the site
  const existingSite = await prisma.site.findFirst({
    where: {
      id: siteId,
      user_id: userId,
    },
  });

  if (!existingSite) {
    throw new Error("Site not found or access denied");
  }

  // Delete from database (this will cascade delete related records)
  await prisma.site.delete({
    where: { id: siteId },
  });

  // Drop the vector collection
  try {
    await dropSiteCollection(siteId);
    console.log(`Dropped vector collection for site: ${siteId}`);
  } catch (error) {
    console.error(`Failed to drop collection for site ${siteId}:`, error);
  }
};

/**
 * Update site embedding status
 */
export const updateSiteEmbeddingStatus = async (
  siteId: string,
  status: Site["embedding_status"],
  postCount?: number,
  chunkCount?: number
): Promise<void> => {
  const updateData: any = {
    embedding_status: status,
  };

  if (status === "completed") {
    updateData.last_embedding_at = new Date();
  }

  if (postCount !== undefined) {
    updateData.post_count = postCount;
  }

  if (chunkCount !== undefined) {
    updateData.chunk_count = chunkCount;
  }

  await prisma.site.update({
    where: { id: siteId },
    data: updateData,
  });
};

/**
 * Get site statistics with vector store data
 */
export const getSiteStatistics = async (
  siteId: string,
  userId: string
): Promise<Site & { vectorStats?: any }> => {
  const site = await getSiteByIdForUser(siteId, userId);
  if (!site) {
    throw new Error("Site not found or access denied");
  }

  try {
    const vectorStats = await getSiteStats(siteId);
    return {
      ...site,
      vectorStats,
    };
  } catch (error) {
    console.error(`Failed to get vector stats for site ${siteId}:`, error);
    return site;
  }
};

/**
 * Get all sites (admin function)
 */
export const getAllSites = async (): Promise<Site[]> => {
  const prismaSites = await prisma.site.findMany({
    orderBy: { created_at: "desc" },
  });

  return prismaSites.map(mapPrismaSiteToSite);
};

/**
 * Search sites by various criteria (admin function)
 */
export const searchSites = async (
  query?: string,
  userId?: string
): Promise<Site[]> => {
  const where: any = {};

  if (userId) {
    where.user_id = userId;
  }

  if (query) {
    const lowerQuery = query.toLowerCase();
    where.OR = [
      { name: { contains: lowerQuery, mode: "insensitive" } },
      { url: { contains: lowerQuery, mode: "insensitive" } },
      { description: { contains: lowerQuery, mode: "insensitive" } },
    ];
  }

  const prismaSites = await prisma.site.findMany({
    where,
    orderBy: { created_at: "desc" },
  });

  return prismaSites.map(mapPrismaSiteToSite);
};

/**
 * Get site count for user
 */
export const getSiteCountForUser = async (userId: string): Promise<number> => {
  return prisma.site.count({
    where: { user_id: userId },
  });
};
