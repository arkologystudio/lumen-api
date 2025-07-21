/**
 * Activity Log Service
 * Manages activity tracking for Recent Activity feed
 */

import { prisma } from "../config/database";
import { Request } from "express";
import {
  ActivityLog,
  CreateActivityRequest,
  ActivityLogResponse,
} from "../types";

/**
 * Activity types for consistent logging
 */
export const ACTIVITY_TYPES = {
  // User activities
  USER_REGISTERED: "user_registered",
  USER_LOGIN: "user_login",
  USER_PROFILE_UPDATED: "user_profile_updated",
  USER_PASSWORD_CHANGED: "user_password_changed",

  // Site activities
  SITE_CREATED: "site_created",
  SITE_UPDATED: "site_updated",
  SITE_DELETED: "site_deleted",
  SITE_EMBEDDED: "site_embedded",

  // Product activities
  PRODUCT_REGISTERED: "product_registered",
  PRODUCT_UPDATED: "product_updated",
  PRODUCT_UNREGISTERED: "product_unregistered",
  PRODUCT_USED: "product_used",

  // Search activities
  SEARCH_PERFORMED: "search_performed",

  // API activities
  API_KEY_CREATED: "api_key_created",
  API_KEY_DELETED: "api_key_deleted",
} as const;

/**
 * Extract IP and User Agent from request
 */
export const extractRequestInfo = (req: Request) => ({
  ip_address: req.ip || req.connection.remoteAddress || undefined,
  user_agent: req.get("User-Agent") || undefined,
});

/**
 * Log a new activity
 */
export const logActivity = async (
  activityData: CreateActivityRequest
): Promise<ActivityLog> => {
  try {
    const activityLog = await prisma.activityLog.create({
      data: {
        user_id: activityData.user_id,
        activity_type: activityData.activity_type,
        title: activityData.title,
        description: activityData.description,
        site_id: activityData.site_id,
        target_id: activityData.target_id,
        target_type: activityData.target_type,
        metadata: activityData.metadata || {},
        ip_address: activityData.ip_address,
        user_agent: activityData.user_agent,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            created_at: true,
            updated_at: true,
            is_active: true,
            subscription_tier: true,
          },
        },
        site: {
          select: {
            id: true,
            name: true,
            url: true,
            description: true,
            created_at: true,
            updated_at: true,
            is_active: true,
            embedding_status: true,
            last_embedding_at: true,
            post_count: true,
            chunk_count: true,
            user_id: true,
          },
        },
      },
    });

    return {
      id: activityLog.id,
      user_id: activityLog.user_id,
      activity_type: activityLog.activity_type,
      title: activityLog.title,
      description: activityLog.description ?? undefined,
      site_id: activityLog.site_id ?? undefined,
      target_id: activityLog.target_id ?? undefined,
      target_type: activityLog.target_type ?? undefined,
      metadata: (activityLog.metadata as Record<string, any>) || {},
      created_at: activityLog.created_at.toISOString(),
      user: {
        id: activityLog.user.id,
        name: activityLog.user.name,
        email: activityLog.user.email,
        created_at: activityLog.user.created_at.toISOString(),
        updated_at: activityLog.user.updated_at.toISOString(),
        is_active: activityLog.user.is_active,
        subscription_tier: activityLog.user.subscription_tier as "free" | "pro" | "enterprise",
      },
      site: activityLog.site
        ? {
            id: activityLog.site.id,
            name: activityLog.site.name,
            url: activityLog.site.url,
            description: activityLog.site.description ?? undefined,
            created_at: activityLog.site.created_at.toISOString(),
            updated_at: activityLog.site.updated_at.toISOString(),
            is_active: activityLog.site.is_active,
            embedding_status: activityLog.site.embedding_status as "not_started" | "in_progress" | "completed" | "failed",
            last_embedding_at: activityLog.site.last_embedding_at?.toISOString(),
            post_count: activityLog.site.post_count,
            chunk_count: activityLog.site.chunk_count,
            user_id: activityLog.site.user_id,
          }
        : undefined,
    };
  } catch (error) {
    console.error("Error logging activity:", error);
    throw error;
  }
};

/**
 * Convenience function to log activity with request info
 */
export const logActivityWithRequest = async (
  req: Request,
  userId: string,
  activityType: string,
  title: string,
  options: {
    description?: string;
    siteId?: string;
    targetId?: string;
    targetType?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<ActivityLog> => {
  const requestInfo = extractRequestInfo(req);

  return logActivity({
    user_id: userId,
    activity_type: activityType,
    title,
    description: options.description,
    site_id: options.siteId,
    target_id: options.targetId,
    target_type: options.targetType,
    metadata: options.metadata,
    ip_address: requestInfo.ip_address,
    user_agent: requestInfo.user_agent,
  });
};

/**
 * Get user's recent activities
 */
export const getUserActivities = async (
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    activityTypes?: string[];
    siteId?: string;
  } = {}
): Promise<ActivityLogResponse> => {
  try {
    const { limit = 20, offset = 0, activityTypes, siteId } = options;

    // Build where clause
    const whereClause: any = {
      user_id: userId,
    };

    if (activityTypes && activityTypes.length > 0) {
      whereClause.activity_type = {
        in: activityTypes,
      };
    }

    if (siteId) {
      whereClause.site_id = siteId;
    }

    // Get activities with count
    const [activities, totalCount] = await Promise.all([
      prisma.activityLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          site: {
            select: {
              id: true,
              name: true,
              url: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
        take: limit + 1, // Take one extra to check if there are more
        skip: offset,
      }),
      prisma.activityLog.count({
        where: whereClause,
      }),
    ]);

    // Check if there are more activities
    const hasMore = activities.length > limit;
    const returnActivities = hasMore ? activities.slice(0, limit) : activities;

    return {
      activities: returnActivities.map((activity: any) => ({
        ...activity,
        metadata: (activity.metadata as Record<string, any>) || {},
        created_at: activity.created_at.toISOString(),
      })),
      total: totalCount,
      has_more: hasMore,
    };
  } catch (error) {
    console.error("Error getting user activities:", error);
    throw error;
  }
};

/**
 * Get site activities (for site-specific activity feed)
 */
export const getSiteActivities = async (
  siteId: string,
  options: {
    limit?: number;
    offset?: number;
    activityTypes?: string[];
  } = {}
): Promise<ActivityLogResponse> => {
  try {
    const { limit = 20, offset = 0, activityTypes } = options;

    // Build where clause
    const whereClause: any = {
      site_id: siteId,
    };

    if (activityTypes && activityTypes.length > 0) {
      whereClause.activity_type = {
        in: activityTypes,
      };
    }

    // Get activities with count
    const [activities, totalCount] = await Promise.all([
      prisma.activityLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          site: {
            select: {
              id: true,
              name: true,
              url: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
        take: limit + 1,
        skip: offset,
      }),
      prisma.activityLog.count({
        where: whereClause,
      }),
    ]);

    const hasMore = activities.length > limit;
    const returnActivities = hasMore ? activities.slice(0, limit) : activities;

    return {
      activities: returnActivities.map((activity: any) => ({
        ...activity,
        metadata: (activity.metadata as Record<string, any>) || {},
        created_at: activity.created_at.toISOString(),
      })),
      total: totalCount,
      has_more: hasMore,
    };
  } catch (error) {
    console.error("Error getting site activities:", error);
    throw error;
  }
};

/**
 * Get system-wide activities (admin only)
 */
export const getSystemActivities = async (
  options: {
    limit?: number;
    offset?: number;
    activityTypes?: string[];
    userId?: string;
    siteId?: string;
  } = {}
): Promise<ActivityLogResponse> => {
  try {
    const { limit = 50, offset = 0, activityTypes, userId, siteId } = options;

    // Build where clause
    const whereClause: any = {};

    if (activityTypes && activityTypes.length > 0) {
      whereClause.activity_type = {
        in: activityTypes,
      };
    }

    if (userId) {
      whereClause.user_id = userId;
    }

    if (siteId) {
      whereClause.site_id = siteId;
    }

    // Get activities with count
    const [activities, totalCount] = await Promise.all([
      prisma.activityLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          site: {
            select: {
              id: true,
              name: true,
              url: true,
            },
          },
        },
        orderBy: {
          created_at: "desc",
        },
        take: limit + 1,
        skip: offset,
      }),
      prisma.activityLog.count({
        where: whereClause,
      }),
    ]);

    const hasMore = activities.length > limit;
    const returnActivities = hasMore ? activities.slice(0, limit) : activities;

    return {
      activities: returnActivities.map((activity: any) => ({
        ...activity,
        metadata: (activity.metadata as Record<string, any>) || {},
        created_at: activity.created_at.toISOString(),
      })),
      total: totalCount,
      has_more: hasMore,
    };
  } catch (error) {
    console.error("Error getting system activities:", error);
    throw error;
  }
};

/**
 * Clean up old activities (for maintenance)
 */
export const cleanupOldActivities = async (
  daysToKeep: number = 90
): Promise<number> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.activityLog.deleteMany({
      where: {
        created_at: {
          lt: cutoffDate,
        },
      },
    });

    console.log(
      `Cleaned up ${result.count} old activity logs older than ${daysToKeep} days`
    );
    return result.count;
  } catch (error) {
    console.error("Error cleaning up old activities:", error);
    throw error;
  }
};

/**
 * Get activity statistics
 */
export const getActivityStats = async (
  options: {
    userId?: string;
    siteId?: string;
    days?: number;
  } = {}
): Promise<{
  total_activities: number;
  activities_by_type: Record<string, number>;
  recent_activity_count: number;
}> => {
  try {
    const { userId, siteId, days = 30 } = options;

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // Build where clause
    const whereClause: any = {};
    const recentWhereClause: any = {
      created_at: {
        gte: sinceDate,
      },
    };

    if (userId) {
      whereClause.user_id = userId;
      recentWhereClause.user_id = userId;
    }

    if (siteId) {
      whereClause.site_id = siteId;
      recentWhereClause.site_id = siteId;
    }

    // Get statistics
    const [totalCount, recentCount, activitiesByType] = await Promise.all([
      prisma.activityLog.count({ where: whereClause }),
      prisma.activityLog.count({ where: recentWhereClause }),
      prisma.activityLog.groupBy({
        by: ["activity_type"],
        where: whereClause,
        _count: true,
      }),
    ]);

    // Format activities by type
    const activitiesByTypeMap = activitiesByType.reduce(
      (acc: Record<string, number>, item: any) => {
        acc[item.activity_type] = item._count;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      total_activities: totalCount,
      activities_by_type: activitiesByTypeMap,
      recent_activity_count: recentCount,
    };
  } catch (error) {
    console.error("Error getting activity stats:", error);
    throw error;
  }
};
