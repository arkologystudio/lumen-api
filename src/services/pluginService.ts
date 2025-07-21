/**
 * Plugin Service
 * Handles plugin file storage, management, and operations
 */

import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import { PrismaClient } from "@prisma/client";
import {
  Plugin,
  CreatePluginRequest,
  UpdatePluginRequest,
  PluginStats,
  EcosystemProductWithPlugins,
} from "../types";

const prisma = new PrismaClient();

// Configuration for plugin storage
const PLUGINS_STORAGE_DIR = process.env.PLUGINS_STORAGE_DIR || "plugins";
const MAX_FILE_SIZE =
  parseInt(process.env.MAX_PLUGIN_FILE_SIZE || "50") * 1024 * 1024; // 50MB default

/**
 * Initialize plugin storage directory
 */
export const initializePluginStorage = async (): Promise<void> => {
  try {
    await fs.access(PLUGINS_STORAGE_DIR);
  } catch {
    await fs.mkdir(PLUGINS_STORAGE_DIR, { recursive: true });
    console.log(`Created plugin storage directory: ${PLUGINS_STORAGE_DIR}`);
  }
};

/**
 * Generate SHA256 hash for file integrity
 */
const generateFileHash = async (filePath: string): Promise<string> => {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
};

/**
 * Generate secure file path for plugin storage
 */
const generateSecureFilePath = (
  originalFilename: string,
  productSlug: string
): string => {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(8).toString("hex");
  const extension = path.extname(originalFilename);
  const baseName = path.basename(originalFilename, extension);

  const secureFilename = `${productSlug}-${baseName}-${timestamp}-${randomSuffix}${extension}`;
  return path.join(PLUGINS_STORAGE_DIR, secureFilename);
};

/**
 * Create a new plugin with file upload
 */
export const createPlugin = async (
  request: CreatePluginRequest,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<Plugin> => {
  const {
    product_id,
    name,
    filename,
    version = "1.0",
    description,
    content_type = "application/zip",
    is_public = false,
    release_notes,
    changelog,
    max_downloads,
  } = request;

  // Verify product exists
  const product = await prisma.ecosystemProduct.findUnique({
    where: { id: product_id },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  if (!product.is_active) {
    throw new Error("Product is not active");
  }

  // Validate file size
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds maximum allowed size of ${
        MAX_FILE_SIZE / 1024 / 1024
      }MB`
    );
  }

  // Initialize storage directory
  await initializePluginStorage();

  // Generate secure file path
  const filePath = generateSecureFilePath(originalFilename, product.slug);

  try {
    // Write file to storage
    await fs.writeFile(filePath, fileBuffer);

    // Generate file hash for integrity
    const fileHash = await generateFileHash(filePath);

    // Create plugin record in database
    const prismaPlugin = await prisma.plugin.create({
      data: {
        product_id,
        name,
        filename: filename || originalFilename,
        version,
        description,
        file_path: filePath,
        file_size: fileBuffer.length,
        file_hash: fileHash,
        content_type,
        is_active: true,
        is_public,
        release_notes,
        changelog,
        max_downloads,
      },
      include: {
        product: true,
      },
    });

    return mapPrismaPluginToPlugin(prismaPlugin);
  } catch (error) {
    // Clean up file if database operation fails
    try {
      await fs.unlink(filePath);
    } catch (cleanupError) {
      console.error("Failed to clean up file after error:", cleanupError);
    }
    throw error;
  }
};

/**
 * Get plugin by ID
 */
export const getPluginById = async (
  pluginId: string
): Promise<Plugin | null> => {
  const plugin = await prisma.plugin.findUnique({
    where: { id: pluginId },
    include: {
      product: true,
    },
  });

  return plugin ? mapPrismaPluginToPlugin(plugin) : null;
};

/**
 * Get all plugins for a product
 */
export const getPluginsByProduct = async (
  productId: string,
  includeInactive = false
): Promise<Plugin[]> => {
  const whereClause: any = { product_id: productId };

  if (!includeInactive) {
    whereClause.is_active = true;
  }

  const plugins = await prisma.plugin.findMany({
    where: whereClause,
    include: {
      product: true,
    },
    orderBy: { created_at: "desc" },
  });

  return plugins.map(mapPrismaPluginToPlugin);
};

/**
 * Get all active plugins
 */
export const getAllActivePlugins = async (): Promise<Plugin[]> => {
  const plugins = await prisma.plugin.findMany({
    where: { is_active: true },
    include: {
      product: true,
    },
    orderBy: [{ product: { name: "asc" } }, { version: "desc" }],
  });

  return plugins.map(mapPrismaPluginToPlugin);
};

/**
 * Update plugin metadata (not the file)
 */
export const updatePlugin = async (
  pluginId: string,
  updates: UpdatePluginRequest
): Promise<Plugin> => {
  const updateData: any = {};

  if (updates.name !== undefined) {
    updateData.name = updates.name;
  }

  if (updates.version !== undefined) {
    updateData.version = updates.version;
  }

  if (updates.description !== undefined) {
    updateData.description = updates.description;
  }

  if (updates.is_active !== undefined) {
    updateData.is_active = updates.is_active;
  }

  if (updates.is_public !== undefined) {
    updateData.is_public = updates.is_public;
  }

  if (updates.release_notes !== undefined) {
    updateData.release_notes = updates.release_notes;
  }

  if (updates.changelog !== undefined) {
    updateData.changelog = updates.changelog;
  }

  if (updates.max_downloads !== undefined) {
    updateData.max_downloads = updates.max_downloads;
  }

  const updatedPlugin = await prisma.plugin.update({
    where: { id: pluginId },
    data: updateData,
    include: {
      product: true,
    },
  });

  return mapPrismaPluginToPlugin(updatedPlugin);
};

/**
 * Update plugin file (upload new version)
 */
export const updatePluginFile = async (
  pluginId: string,
  fileBuffer: Buffer,
  originalFilename: string,
  version?: string
): Promise<Plugin> => {
  const plugin = await getPluginById(pluginId);
  if (!plugin) {
    throw new Error("Plugin not found");
  }

  // Validate file size
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds maximum allowed size of ${
        MAX_FILE_SIZE / 1024 / 1024
      }MB`
    );
  }

  // Generate new secure file path
  const newFilePath = generateSecureFilePath(
    originalFilename,
    plugin.product?.slug || "unknown"
  );

  try {
    // Write new file to storage
    await fs.writeFile(newFilePath, fileBuffer);

    // Generate new file hash
    const newFileHash = await generateFileHash(newFilePath);

    // Update plugin record
    const updateData: any = {
      file_path: newFilePath,
      file_size: fileBuffer.length,
      file_hash: newFileHash,
      filename: originalFilename,
    };

    if (version) {
      updateData.version = version;
    }

    const updatedPlugin = await prisma.plugin.update({
      where: { id: pluginId },
      data: updateData,
      include: {
        product: true,
      },
    });

    // Clean up old file
    try {
      await fs.unlink(plugin.file_path);
    } catch (cleanupError) {
      console.error("Failed to clean up old file:", cleanupError);
    }

    return mapPrismaPluginToPlugin(updatedPlugin);
  } catch (error) {
    // Clean up new file if database operation fails
    try {
      await fs.unlink(newFilePath);
    } catch (cleanupError) {
      console.error("Failed to clean up new file after error:", cleanupError);
    }
    throw error;
  }
};

/**
 * Delete plugin and its file
 */
export const deletePlugin = async (pluginId: string): Promise<void> => {
  const plugin = await getPluginById(pluginId);
  if (!plugin) {
    throw new Error("Plugin not found");
  }

  // Check if plugin has active licenses
  const activeLicenseCount = await prisma.license.count({
    where: {
      plugin_id: pluginId,
      status: "active",
    },
  });

  if (activeLicenseCount > 0) {
    throw new Error(
      `Cannot delete plugin: ${activeLicenseCount} active licenses exist`
    );
  }

  // Delete plugin record from database
  await prisma.plugin.delete({
    where: { id: pluginId },
  });

  // Clean up file
  try {
    await fs.unlink(plugin.file_path);
  } catch (cleanupError) {
    console.error("Failed to clean up plugin file:", cleanupError);
  }
};

/**
 * Verify plugin file integrity
 */
export const verifyPluginIntegrity = async (
  pluginId: string
): Promise<boolean> => {
  const plugin = await getPluginById(pluginId);
  if (!plugin) {
    throw new Error("Plugin not found");
  }

  try {
    const currentHash = await generateFileHash(plugin.file_path);
    return currentHash === plugin.file_hash;
  } catch (error) {
    console.error("Error verifying plugin integrity:", error);
    return false;
  }
};

/**
 * Get plugin file stream for download
 */
export const getPluginFileStream = async (
  pluginId: string
): Promise<{
  stream: NodeJS.ReadableStream;
  plugin: Plugin;
}> => {
  const plugin = await getPluginById(pluginId);
  if (!plugin) {
    throw new Error("Plugin not found");
  }

  if (!plugin.is_active) {
    throw new Error("Plugin is not active");
  }

  try {
    // Verify file exists
    await fs.access(plugin.file_path);

    // Verify file integrity
    const isIntegrityValid = await verifyPluginIntegrity(pluginId);
    if (!isIntegrityValid) {
      throw new Error("Plugin file integrity check failed");
    }

    const fs_sync = require("fs");
    const stream = fs_sync.createReadStream(plugin.file_path);

    return { stream, plugin };
  } catch (error) {
    throw new Error(
      `Failed to access plugin file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
};

/**
 * Get plugin statistics
 */
export const getPluginStats = async (
  pluginId: string
): Promise<PluginStats> => {
  // Get total downloads
  const totalDownloads = await prisma.download.count({
    where: {
      plugin_id: pluginId,
      status: "completed",
    },
  });

  // Get license counts
  const totalLicenses = await prisma.license.count({
    where: { plugin_id: pluginId },
  });

  const activeLicenses = await prisma.license.count({
    where: {
      plugin_id: pluginId,
      status: "active",
    },
  });

  // Get download trend (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const downloadTrend = await prisma.download.groupBy({
    by: ["started_at"],
    where: {
      plugin_id: pluginId,
      status: "completed",
      started_at: {
        gte: thirtyDaysAgo,
      },
    },
    _count: {
      id: true,
    },
  });

  // Format download trend data
  const trendData = downloadTrend.map((item: any) => ({
    date: item.started_at.toISOString().split("T")[0],
    downloads: item._count.id,
  }));

  return {
    total_downloads: totalDownloads,
    active_licenses: activeLicenses,
    total_licenses: totalLicenses,
    download_trend: trendData,
  };
};

/**
 * Get ecosystem product with plugins
 */
export const getProductWithPlugins = async (
  productId: string
): Promise<EcosystemProductWithPlugins | null> => {
  const product = await prisma.ecosystemProduct.findUnique({
    where: { id: productId },
    include: {
      plugins: {
        where: { is_active: true },
        orderBy: { version: "desc" },
      },
    },
  });

  if (!product) {
    return null;
  }

  return {
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
    plugins: product.plugins.map(mapPrismaPluginToPlugin),
    has_downloadable_content: product.plugins.length > 0,
  };
};

/**
 * Search plugins by name or description
 */
export const searchPlugins = async (
  query: string,
  includeInactive = false
): Promise<Plugin[]> => {
  const whereClause: any = {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { product: { name: { contains: query, mode: "insensitive" } } },
    ],
  };

  if (!includeInactive) {
    whereClause.is_active = true;
  }

  const plugins = await prisma.plugin.findMany({
    where: whereClause,
    include: {
      product: true,
    },
    orderBy: { created_at: "desc" },
  });

  return plugins.map(mapPrismaPluginToPlugin);
};

/**
 * Map Prisma plugin object to Plugin interface
 */
const mapPrismaPluginToPlugin = (prismaPlugin: any): Plugin => {
  return {
    id: prismaPlugin.id,
    product_id: prismaPlugin.product_id,
    name: prismaPlugin.name,
    filename: prismaPlugin.filename,
    version: prismaPlugin.version,
    description: prismaPlugin.description,
    file_path: prismaPlugin.file_path,
    file_size: prismaPlugin.file_size,
    file_hash: prismaPlugin.file_hash,
    content_type: prismaPlugin.content_type,
    is_active: prismaPlugin.is_active,
    is_public: prismaPlugin.is_public,
    release_notes: prismaPlugin.release_notes,
    changelog: prismaPlugin.changelog,
    max_downloads: prismaPlugin.max_downloads,
    created_at: prismaPlugin.created_at.toISOString(),
    updated_at: prismaPlugin.updated_at.toISOString(),
    product: prismaPlugin.product
      ? {
          id: prismaPlugin.product.id,
          name: prismaPlugin.product.name,
          slug: prismaPlugin.product.slug,
          description: prismaPlugin.product.description,
          category: prismaPlugin.product.category,
          version: prismaPlugin.product.version,
          is_active: prismaPlugin.product.is_active,
          is_beta: prismaPlugin.product.is_beta,
          base_price: prismaPlugin.product.base_price,
          usage_based: prismaPlugin.product.usage_based,
          features: (prismaPlugin.product.features as string[]) || [],
          limits: (prismaPlugin.product.limits as Record<string, any>) || {},
          extended_documentation:
            prismaPlugin.product.extended_documentation || "",
          created_at: prismaPlugin.product.created_at.toISOString(),
          updated_at: prismaPlugin.product.updated_at.toISOString(),
        }
      : undefined,
  };
};
