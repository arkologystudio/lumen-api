/**
 * Download Controller
 * Handles protected plugin downloads with license validation
 */

import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  InitiateDownloadRequest,
  InitiateDownloadResponse,
} from "../types";
import {
  validateLicense,
  incrementDownloadCount,
} from "../services/licenseService";
import { 
  getProductBySlug 
} from "../services/ecosystemProductService";
import { prisma } from "../config/database";
import * as fs from "fs";

/**
 * Create a download record in the database
 */
const createDownloadRecord = async (
  userId: string,
  productId: string,
  licenseId: string,
  token: string,
  userAgent?: string,
  ipAddress?: string
) => {
  return await prisma.download.create({
    data: {
      user_id: userId,
      product_id: productId,
      license_id: licenseId,
      download_token: token,
      token_expires: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      user_agent: userAgent,
      ip_address: ipAddress,
      status: "initiated",
    },
  });
};

/**
 * Generate a secure download token
 */
const generateDownloadToken = (): string => {
  return require("crypto").randomBytes(32).toString("hex");
};

/**
 * Initiate a plugin download (creates temporary download token)
 */
export const initiateDownload = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { product_slug, license_key }: InitiateDownloadRequest = req.body;

    if (!product_slug || !license_key) {
      res.status(400).json({
        success: false,
        error: "product_slug and license_key are required",
      });
      return;
    }

    // Validate the license
    const license = await validateLicense(license_key, product_slug);

    if (!license) {
      res.status(403).json({
        success: false,
        error: "Invalid or expired license",
      });
      return;
    }

    // Check download limits
    if (license.max_downloads && license.download_count >= license.max_downloads) {
      res.status(403).json({
        success: false,
        error: "Download limit exceeded for this license",
      });
      return;
    }

    // Get the product to access file information
    const product = await getProductBySlug(product_slug);

    if (!product) {
      res.status(404).json({
        success: false,
        error: "Product not found",
      });
      return;
    }

    // Check if product has downloadable content
    if (!product.file_path || !product.filename) {
      res.status(400).json({
        success: false,
        error: "Product does not have downloadable content",
      });
      return;
    }

    // Generate download token
    const downloadToken = generateDownloadToken();

    // Create download record
    await createDownloadRecord(
      userId,
      product.id,
      license.id,
      downloadToken,
      req.headers["user-agent"],
      req.ip
    );

    const response: InitiateDownloadResponse = {
      success: true,
      download_token: downloadToken,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      plugin: {
        name: product.name,
        filename: product.filename || "",
        file_size: product.file_size || 0,
        version: product.version,
      },
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
 * Download the plugin file using the temporary token
 */
export const downloadWithToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { download_token } = req.params;

    // Find and validate download record
    const download = await prisma.download.findFirst({
      where: { download_token },
      include: {
        product: true,
        license: true,
      },
    });

    if (!download) {
      res.status(404).json({
        success: false,
        error: "Download token not found",
      });
      return;
    }

    if (download.token_expires && new Date() > download.token_expires) {
      res.status(410).json({
        success: false,
        error: "Download token has expired",
      });
      return;
    }

    if (download.status !== "initiated") {
      res.status(400).json({
        success: false,
        error: "Download already in progress or completed",
      });
      return;
    }

    // Validate license is still active
    const license = await validateLicense(download.license.license_key, download.product.slug);

    if (!license) {
      res.status(403).json({
        success: false,
        error: "License is no longer valid",
      });
      return;
    }

    // Check if product has downloadable file
    if (!download.product.file_path) {
      res.status(404).json({
        success: false,
        error: "Product file not found",
      });
      return;
    }

    // Get file stream
    const filePath = download.product.file_path;
    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        error: "Product file not found on disk",
      });
      return;
    }

    // Update download status
    await prisma.download.update({
      where: { id: download.id },
      data: { status: "in_progress" },
    });

    // Set response headers
    res.setHeader("Content-Type", download.product.content_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${download.product.filename}"`);
    res.setHeader("Content-Length", download.product.file_size || 0);

    // Create read stream
    const stream = fs.createReadStream(filePath);

    stream.on("error", (error: Error) => {
      console.error("Error streaming file:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: "Error streaming file",
        });
      }
    });

    stream.on("end", async () => {
      try {
        // Update download status and increment counter
        await Promise.all([
          prisma.download.update({
            where: { id: download.id },
            data: {
              status: "completed",
              completed_at: new Date(),
              bytes_downloaded: download.product.file_size,
            },
          }),
          incrementDownloadCount(download.license_id),
        ]);
      } catch (error) {
        console.error("Error updating download completion:", error);
      }
    });

    // Pipe the file to response
    stream.pipe(res);
  } catch (error) {
    console.error("Error downloading file:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Failed to download file",
      });
    }
  }
};

/**
 * Get download history for the current user
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

    const { limit = "20", offset = "0" } = req.query;
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    const whereClause = {
      user_id: req.user.id,
    };

    const [downloads, total] = await Promise.all([
      prisma.download.findMany({
        where: whereClause,
        include: {
          product: true,
          license: true,
        },
        orderBy: { created_at: "desc" },
        skip: offsetNum,
        take: limitNum,
      }),
      prisma.download.count({ where: whereClause }),
    ]);

    const downloadHistory = downloads.map((download: any) => ({
      id: download.id,
      product: {
        id: download.product.id,
        name: download.product.name,
        filename: download.product.filename,
        version: download.product.version,
        file_size: download.product.file_size,
        slug: download.product.slug,
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
      total,
      has_more: total > offsetNum + limitNum,
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
 * Get download status by token
 */
export const getDownloadStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.params;

    const download = await prisma.download.findFirst({
      where: { download_token: token },
      include: {
        product: true,
        license: true,
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
        product: {
          name: download.product.name,
          filename: download.product.filename,
          file_size: download.product.file_size,
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
