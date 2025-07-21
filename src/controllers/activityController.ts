/**
 * Activity Controller
 * Handles API endpoints for activity logging and Recent Activity feed
 */

import { Request, Response } from "express";
import {
  getUserActivities,
  getSiteActivities,
  getSystemActivities,
  getActivityStats,
} from "../services/activityLogService";

/**
 * GET /api/users/activities
 * Get current user's recent activities
 */
export const getUserActivitiesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).auth?.jti;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
      return;
    }

    const { limit = "20", offset = "0", activity_types, site_id } = req.query;

    // Parse activity types if provided
    let activityTypes: string[] | undefined;
    if (activity_types && typeof activity_types === "string") {
      activityTypes = activity_types.split(",").map((type) => type.trim());
    }

    const activities = await getUserActivities(userId, {
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      activityTypes,
      siteId: site_id as string,
    });

    res.json({
      success: true,
      ...activities,
    });
  } catch (error) {
    console.error("Error getting user activities:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get user activities",
    });
  }
};

/**
 * GET /api/sites/:siteId/activities
 * Get activities for a specific site
 */
export const getSiteActivitiesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { siteId } = req.params;
    const { limit = "20", offset = "0", activity_types } = req.query;

    // Parse activity types if provided
    let activityTypes: string[] | undefined;
    if (activity_types && typeof activity_types === "string") {
      activityTypes = activity_types.split(",").map((type) => type.trim());
    }

    const activities = await getSiteActivities(siteId, {
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      activityTypes,
    });

    res.json({
      success: true,
      ...activities,
    });
  } catch (error) {
    console.error("Error getting site activities:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get site activities",
    });
  }
};

/**
 * GET /api/admin/activities
 * Get system-wide activities (admin only)
 */
export const getSystemActivitiesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      limit = "50",
      offset = "0",
      activity_types,
      user_id,
      site_id,
    } = req.query;

    // Parse activity types if provided
    let activityTypes: string[] | undefined;
    if (activity_types && typeof activity_types === "string") {
      activityTypes = activity_types.split(",").map((type) => type.trim());
    }

    const activities = await getSystemActivities({
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      activityTypes,
      userId: user_id as string,
      siteId: site_id as string,
    });

    res.json({
      success: true,
      ...activities,
    });
  } catch (error) {
    console.error("Error getting system activities:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get system activities",
    });
  }
};

/**
 * GET /api/users/activities/stats
 * Get activity statistics for current user
 */
export const getUserActivityStatsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).auth?.jti;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
      return;
    }

    const { site_id, days = "30" } = req.query;

    const stats = await getActivityStats({
      userId,
      siteId: site_id as string,
      days: parseInt(days as string, 10),
    });

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error getting user activity stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get activity statistics",
    });
  }
};

/**
 * GET /api/sites/:siteId/activities/stats
 * Get activity statistics for a specific site
 */
export const getSiteActivityStatsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { siteId } = req.params;
    const { days = "30" } = req.query;

    const stats = await getActivityStats({
      siteId,
      days: parseInt(days as string, 10),
    });

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error getting site activity stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get site activity statistics",
    });
  }
};

/**
 * GET /api/admin/activities/stats
 * Get system-wide activity statistics (admin only)
 */
export const getSystemActivityStatsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { user_id, site_id, days = "30" } = req.query;

    const stats = await getActivityStats({
      userId: user_id as string,
      siteId: site_id as string,
      days: parseInt(days as string, 10),
    });

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error getting system activity stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get system activity statistics",
    });
  }
};
