/**
 * Download Controller
 * Handles protected plugin downloads with license validation
 */

import { Request, Response } from "express";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  validateLicense,
  incrementDownloadCount,
} from "../services/licenseService";
import { getPluginFileStream, getPluginById } from "../services/pluginService";
import {
  InitiateDownloadRequest,
  InitiateDownloadResponse,
  DownloadWithTokenRequest,
} from "../types";

const prisma = new PrismaClient();

// Configuration
const DOWNLOAD_TOKEN_EXPIRY_MINUTES = 30; // 30 minutes to complete download

/**
 * Generate a secure download token
 */
const generateDownloadToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Create download record
 */
const createDownloadRecord = async (
  userId: string,
  pluginId: string,
  licenseId: string,
  downloadToken: string,
  req: Request
): Promise<string> => {
  const tokenExpires = new Date();
  tokenExpires.setMinutes(
    tokenExpires.getMinutes() + DOWNLOAD_TOKEN_EXPIRY_MINUTES
  );

  const download = await prisma.download.create({
    data: {
      user_id: userId,
      plugin_id: pluginId,
      license_id: licenseId,
      download_token: downloadToken,
      token_expires: tokenExpires,
      ip_address: req.ip || req.connection.remoteAddress || null,
      user_agent: req.get("User-Agent") || null,
      referer: req.get("Referer") || null,
      status: "initiated",
    },
  });

  return download.id;
};

/**
 * POST /api/downloads/initiate
 * Initiate a plugin download with license validation
 */
export const initiateDownload = async (
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

    const { plugin_id, license_key }: InitiateDownloadRequest = req.body;

    if (!plugin_id || !license_key) {
      res.status(400).json({
        success: false,
        error: "Plugin ID and license key are required",
      });
      return;
    }

    // Get plugin information
    const plugin = await getPluginById(plugin_id);
    if (!plugin) {
      res.status(404).json({
        success: false,
        error: "Plugin not found",
      });
      return;
    }

    if (!plugin.is_active) {
      res.status(400).json({
        success: false,
        error: "Plugin is not available for download",
      });
      return;
    }

    // Validate license
    const licenseValidation = await validateLicense({
      license_key,
      plugin_id,
    });

    if (!licenseValidation.valid) {
      res.status(403).json({
        success: false,
        error: licenseValidation.message || "Invalid license",
      });
      return;
    }

    if (!licenseValidation.download_allowed) {
      res.status(403).json({
        success: false,
        error: "Download limit exceeded for this license",
      });
      return;
    }

    if (!licenseValidation.license) {
      res.status(403).json({
        success: false,
        error: "License information not available",
      });
      return;
    }

    // Verify user owns the license
    if (licenseValidation.license.user_id !== req.user.id) {
      res.status(403).json({
        success: false,
        error: "License does not belong to authenticated user",
      });
      return;
    }

    // Generate download token
    const downloadToken = generateDownloadToken();

    // Create download record
    const downloadId = await createDownloadRecord(
      req.user.id,
      plugin_id,
      licenseValidation.license.id,
      downloadToken,
      req
    );

    // Generate download URL
    const downloadUrl = `/api/downloads/file/${downloadToken}`;

    const response: InitiateDownloadResponse = {
      success: true,
      download_token: downloadToken,
      download_url: downloadUrl,
      expires_at: new Date(
        Date.now() + DOWNLOAD_TOKEN_EXPIRY_MINUTES * 60 * 1000
      ).toISOString(),
      plugin: plugin,
      message: "Download initiated successfully",
    };

    res.json(response);
  } catch (error) {
    console.error("Error initiating download:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initiate download",
    });
  }
};

/**
 * GET /api/downloads/file/:token
 * Download plugin file using temporary token
 */
export const downloadWithToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({
        success: false,
        error: "Download token is required",
      });
      return;
    }

    // Find download record by token
    const download = await prisma.download.findFirst({
      where: {
        download_token: token,
        status: "initiated",
      },
      include: {
        plugin: true,
        license: true,
        user: true,
      },
    });

    if (!download) {
      res.status(404).json({
        success: false,
        error: "Invalid or expired download token",
      });
      return;
    }

    // Check if token has expired
    if (download.token_expires && new Date() > download.token_expires) {
      // Update download status to failed
      await prisma.download.update({
        where: { id: download.id },
        data: {
          status: "failed",
          error_message: "Download token expired",
        },
      });

      res.status(410).json({
        success: false,
        error: "Download token has expired",
      });
      return;
    }

    // Validate license is still active
    const licenseValidation = await validateLicense({
      license_key: download.license.license_key,
      plugin_id: download.plugin_id,
    });

    if (!licenseValidation.valid || !licenseValidation.download_allowed) {
      await prisma.download.update({
        where: { id: download.id },
        data: {
          status: "failed",
          error_message: "License validation failed",
        },
      });

      res.status(403).json({
        success: false,
        error: "License is no longer valid for download",
      });
      return;
    }

    // Update download status to in_progress
    await prisma.download.update({
      where: { id: download.id },
      data: {
        status: "in_progress",
      },
    });

    try {
      // Get plugin file stream
      const { stream, plugin } = await getPluginFileStream(download.plugin_id);

      // Set response headers
      res.setHeader("Content-Type", plugin.content_type);
      res.setHeader("Content-Length", plugin.file_size);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${plugin.filename}"`
      );
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      // Track bytes downloaded
      let bytesDownloaded = 0;

      stream.on("data", (chunk: Buffer) => {
        bytesDownloaded += chunk.length;
      });

      stream.on("end", async () => {
        // Update download record as completed
        await prisma.download.update({
          where: { id: download.id },
          data: {
            status: "completed",
            completed_at: new Date(),
            bytes_downloaded: bytesDownloaded,
          },
        });

        // Increment license download count
        await incrementDownloadCount(download.license_id);
      });

      stream.on("error", async (error) => {
        console.error("Error streaming file:", error);

        // Update download record as failed
        await prisma.download.update({
          where: { id: download.id },
          data: {
            status: "failed",
            error_message: "File streaming error",
            bytes_downloaded: bytesDownloaded,
          },
        });
      });

      // Stream the file
      stream.pipe(res);
    } catch (fileError) {
      console.error("Error accessing plugin file:", fileError);

      // Update download record as failed
      await prisma.download.update({
        where: { id: download.id },
        data: {
          status: "failed",
          error_message: "Failed to access plugin file",
        },
      });

      res.status(500).json({
        success: false,
        error: "Failed to access plugin file",
      });
    }
  } catch (error) {
    console.error("Error processing download:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process download",
    });
  }
};

/**
 * GET /api/downloads/history
 * Get user's download history
 */
export const getDownloadHistory = async (
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

    const { page = 1, limit = 20, status } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const whereClause: any = { user_id: req.user.id };
    if (status && typeof status === "string") {
      whereClause.status = status;
    }

    const [downloads, total] = await Promise.all([
      prisma.download.findMany({
        where: whereClause,
        include: {
          plugin: {
            include: {
              product: true,
            },
          },
          license: true,
        },
        orderBy: { created_at: "desc" },
        skip: offset,
        take: limitNum,
      }),
      prisma.download.count({ where: whereClause }),
    ]);

    const downloadHistory = downloads.map((download: any) => ({
      id: download.id,
      plugin: {
        id: download.plugin.id,
        name: download.plugin.name,
        filename: download.plugin.filename,
        version: download.plugin.version,
        file_size: download.plugin.file_size,
        product: {
          name: download.plugin.product.name,
          slug: download.plugin.product.slug,
        },
      },
      license_key: download.license.license_key,
      status: download.status,
      started_at: download.started_at.toISOString(),
      completed_at: download.completed_at?.toISOString(),
      bytes_downloaded: download.bytes_downloaded,
      error_message: download.error_message,
    }));

    res.json({
      success: true,
      downloads: downloadHistory,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error getting download history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get download history",
    });
  }
};

/**
 * GET /api/downloads/:downloadId/status
 * Get status of a specific download
 */
export const getDownloadStatus = async (
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

    const { downloadId } = req.params;

    const download = await prisma.download.findFirst({
      where: {
        id: downloadId,
        user_id: req.user.id,
      },
      include: {
        plugin: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!download) {
      res.status(404).json({
        success: false,
        error: "Download not found",
      });
      return;
    }

    res.json({
      success: true,
      download: {
        id: download.id,
        status: download.status,
        started_at: download.started_at.toISOString(),
        completed_at: download.completed_at?.toISOString(),
        bytes_downloaded: download.bytes_downloaded,
        error_message: download.error_message,
        plugin: {
          id: download.plugin.id,
          name: download.plugin.name,
          filename: download.plugin.filename,
          version: download.plugin.version,
          file_size: download.plugin.file_size,
          product: {
            name: download.plugin.product.name,
            slug: download.plugin.product.slug,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error getting download status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get download status",
    });
  }
};

/**
 * DELETE /api/downloads/cleanup-expired
 * Admin endpoint to cleanup expired download tokens
 */
export const cleanupExpiredDownloads = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await prisma.download.updateMany({
      where: {
        token_expires: {
          lt: new Date(),
        },
        status: "initiated",
      },
      data: {
        status: "failed",
        error_message: "Token expired",
      },
    });

    res.json({
      success: true,
      message: `Cleaned up ${result.count} expired download tokens`,
      count: result.count,
    });
  } catch (error) {
    console.error("Error cleaning up expired downloads:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cleanup expired downloads",
    });
  }
};
