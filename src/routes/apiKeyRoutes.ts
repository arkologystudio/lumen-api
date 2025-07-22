/**
 * API Key Management Routes
 * Routes for creating and managing user API keys
 */

import { Router } from "express";
import { authenticateUser, AuthenticatedRequest } from "../middleware/auth";
import {
  createApiKey,
  getUserApiKeys,
  deactivateApiKey,
  updateApiKeyScopes,
} from "../services/apiKeyService";
import { prisma } from "../config/database";

const router = Router();

// All API key routes require user authentication
router.use(authenticateUser);

/**
 * POST /api/api-keys
 * Create a new API key for the authenticated user
 */
router.post("/", async (req: AuthenticatedRequest, res: any) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { name, site_id, scopes } = req.body;

    if (!name || !scopes || !Array.isArray(scopes)) {
      res.status(400).json({
        success: false,
        error: "Name and scopes are required",
      });
      return;
    }

    // Verify site ownership if site_id is provided
    if (site_id) {
      const site = await prisma.site.findFirst({
        where: {
          id: site_id,
          user_id: req.user.id,
          is_active: true,
        },
      });

      if (!site) {
        res.status(404).json({
          success: false,
          error: "Site not found or access denied",
        });
        return;
      }
    }

    const result = await createApiKey({
      user_id: req.user.id,
      site_id,
      name,
      scopes,
    });

    res.status(201).json({
      success: true,
      data: {
        api_key: result.apiKey,
        key: result.key, // Only returned once during creation
      },
      message: "API key created successfully. Store this key securely - it won't be shown again.",
    });
  } catch (error) {
    console.error("Error creating API key:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create API key",
    });
  }
});

/**
 * GET /api/api-keys
 * Get user's API keys
 */
router.get("/", async (req: AuthenticatedRequest, res: any) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const apiKeys = await getUserApiKeys(req.user.id);

    res.json({
      success: true,
      data: apiKeys,
    });
  } catch (error) {
    console.error("Error getting API keys:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get API keys",
    });
  }
});

/**
 * DELETE /api/api-keys/:key_id
 * Deactivate an API key
 */
router.delete("/:key_id", async (req: AuthenticatedRequest, res: any) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { key_id } = req.params;
    await deactivateApiKey(key_id, req.user.id);

    res.json({
      success: true,
      message: "API key deactivated successfully",
    });
  } catch (error) {
    console.error("Error deactivating API key:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to deactivate API key",
    });
  }
});

/**
 * PUT /api/api-keys/:key_id/scopes
 * Update API key scopes
 */
router.put("/:key_id/scopes", async (req: AuthenticatedRequest, res: any) => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const { key_id } = req.params;
    const { scopes } = req.body;

    if (!scopes || !Array.isArray(scopes)) {
      res.status(400).json({
        success: false,
        error: "Scopes array is required",
      });
      return;
    }

    const updatedApiKey = await updateApiKeyScopes(key_id, req.user.id, scopes);

    res.json({
      success: true,
      data: updatedApiKey,
      message: "API key scopes updated successfully",
    });
  } catch (error) {
    console.error("Error updating API key scopes:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update API key scopes",
    });
  }
});

export default router; 