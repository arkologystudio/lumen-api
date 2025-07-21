/**
 * Query Tracking and Validation Middleware
 * Handles usage tracking and license validation for API queries
 */

import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import {
  validateLicense,
  trackQueryUsage,
  getLicenseUsage,
} from "../services/licenseService";
import { QueryType, LicenseType } from "../types";

const prisma = new PrismaClient();

// Extend Request type to include tracking info
declare module "express-serve-static-core" {
  interface Request {
    licenseInfo?: {
      license_id: string;
      user_id: string;
      product_slug: string;
      license_type: LicenseType;
      agent_access_allowed: boolean;
      queries_remaining?: number;
    };
    queryMetrics?: {
      start_time: number;
      query_type: QueryType;
      endpoint: string;
    };
  }
}

/**
 * Middleware to validate license and check query limits
 */
export const validateQueryLicense = (options: {
  product_slug: string;
  query_type: QueryType;
  require_agent_access?: boolean;
}) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        product_slug,
        query_type,
        require_agent_access = false,
      } = options;

      // Get license key from headers or body
      const license_key =
        (req.headers["x-license-key"] as string) ||
        (req.body?.license_key as string);

      if (!license_key) {
        res.status(401).json({
          success: false,
          error: "License key required",
          code: "MISSING_LICENSE_KEY",
        });
        return;
      }

      // Get site ID if provided
      const site_id = req.params.site_id || req.body?.site_id;

      // Detect if this is an agent request
      const user_agent = req.headers["user-agent"] || "";
      const is_agent_request =
        require_agent_access ||
        !user_agent.includes("Mozilla") ||
        req.headers["x-api-client"] === "agent" ||
        !!req.headers["x-api-key"];

      // Validate license
      const validation = await validateLicense({
        license_key,
        product_slug,
        check_agent_access: is_agent_request,
        site_id,
      });

      if (!validation.valid) {
        res.status(403).json({
          success: false,
          error: validation.message || "License validation failed",
          code: "INVALID_LICENSE",
          details: {
            license_status: validation.license?.status,
            expires_at: validation.license?.expires_at,
          },
        });
        return;
      }

      if (!validation.query_allowed) {
        res.status(429).json({
          success: false,
          error: "Query limit exceeded for current billing period",
          code: "QUERY_LIMIT_EXCEEDED",
          details: {
            queries_remaining: validation.queries_remaining,
            license_type: validation.license?.license_type,
            billing_period: validation.license?.billing_period,
          },
        });
        return;
      }

      if (is_agent_request && !validation.agent_access_allowed) {
        res.status(403).json({
          success: false,
          error: "Agent/API access not allowed with current license tier",
          code: "AGENT_ACCESS_DENIED",
          details: {
            license_type: validation.license?.license_type,
            agent_access_required: true,
          },
        });
        return;
      }

      // Store license info in request for tracking
      req.licenseInfo = {
        license_id: validation.license!.id,
        user_id: validation.license!.user_id,
        product_slug,
        license_type: validation.license!.license_type,
        agent_access_allowed: validation.agent_access_allowed,
        queries_remaining: validation.queries_remaining,
      };

      // Store query metrics for tracking
      req.queryMetrics = {
        start_time: Date.now(),
        query_type,
        endpoint: req.originalUrl,
      };

      next();
    } catch (error: any) {
      console.error("License validation error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error during license validation",
        code: "VALIDATION_ERROR",
      });
    }
  };
};

/**
 * Middleware to track query usage after request completion
 */
export const trackQuery = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Set up response tracking
    const originalSend = res.json;

    res.json = function (data: any) {
      // Track the query after response is sent
      setImmediate(async () => {
        try {
          if (req.licenseInfo && req.queryMetrics) {
            const response_time_ms = Date.now() - req.queryMetrics.start_time;

            // Extract results count from response if available
            let results_count: number | undefined;
            if (data?.data?.results?.length) {
              results_count = data.data.results.length;
            } else if (data?.data?.total) {
              results_count = data.data.total;
            }

            // Track query usage
            await trackQueryUsage(req.licenseInfo.license_id, {
              query_type: req.queryMetrics.query_type,
              endpoint: req.queryMetrics.endpoint,
              query_text: extractQueryText(req),
              site_id: req.params.site_id,
              is_agent_request: !req.headers["user-agent"]?.includes("Mozilla"),
              response_time_ms,
              results_count,
            });
          }
        } catch (error) {
          console.error("Query tracking error:", error);
          // Don't fail the request if tracking fails
        }
      });

      // Call original send
      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Extract query text from request for analytics
 */
const extractQueryText = (req: Request): string | undefined => {
  // Try to extract search query from common locations
  return (req.body?.query ||
    req.body?.search ||
    req.query?.q ||
    req.query?.query ||
    req.query?.search) as string | undefined;
};

/**
 * Middleware to check license usage and add to response headers
 */
export const addUsageHeaders = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Set up to add headers after request processing
    const originalSend = res.json;

    res.json = function (data: any) {
      // Add usage information to headers
      setImmediate(async () => {
        try {
          if (req.licenseInfo) {
            const usage = await getLicenseUsage(req.licenseInfo.license_id);

            res.setHeader("X-Queries-Used", usage.queries_used.toString());
            if (usage.queries_remaining !== undefined) {
              res.setHeader(
                "X-Queries-Remaining",
                usage.queries_remaining.toString()
              );
            }
            res.setHeader("X-License-Type", req.licenseInfo.license_type);
            res.setHeader(
              "X-Agent-Access",
              req.licenseInfo.agent_access_allowed.toString()
            );
          }
        } catch (error) {
          console.error("Usage header error:", error);
          // Don't fail the request if header setting fails
        }
      });

      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Combined middleware for full query validation and tracking
 */
export const queryLicenseMiddleware = (options: {
  product_slug: string;
  query_type: QueryType;
  require_agent_access?: boolean;
  track_usage?: boolean;
  include_usage_headers?: boolean;
}) => {
  const middlewares: Array<
    (req: Request, res: Response, next: NextFunction) => Promise<void> | void
  > = [
    validateQueryLicense({
      product_slug: options.product_slug,
      query_type: options.query_type,
      require_agent_access: options.require_agent_access,
    }),
  ];

  if (options.track_usage !== false) {
    middlewares.push(trackQuery());
  }

  if (options.include_usage_headers !== false) {
    middlewares.push(addUsageHeaders());
  }

  return middlewares;
};

/**
 * Simplified middleware for search endpoints
 */
export const searchLicenseMiddleware = (product_slug: string) => {
  return queryLicenseMiddleware({
    product_slug,
    query_type: "search",
    require_agent_access: false,
    track_usage: true,
    include_usage_headers: true,
  });
};

/**
 * Simplified middleware for embedding endpoints
 */
export const embedLicenseMiddleware = (product_slug: string) => {
  return queryLicenseMiddleware({
    product_slug,
    query_type: "embed",
    require_agent_access: false,
    track_usage: true,
    include_usage_headers: true,
  });
};

/**
 * Simplified middleware for analysis endpoints
 */
export const analysisLicenseMiddleware = (product_slug: string) => {
  return queryLicenseMiddleware({
    product_slug,
    query_type: "analysis",
    require_agent_access: false,
    track_usage: true,
    include_usage_headers: true,
  });
};

/**
 * Middleware specifically for agent/API access
 */
export const agentLicenseMiddleware = (options: {
  product_slug: string;
  query_type: QueryType;
}) => {
  return queryLicenseMiddleware({
    product_slug: options.product_slug,
    query_type: options.query_type,
    require_agent_access: true,
    track_usage: true,
    include_usage_headers: true,
  });
};
