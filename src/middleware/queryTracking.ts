/**
 * Query Tracking and Validation Middleware
 * Handles usage tracking and license validation for API queries
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";
import { validateLicense } from "../services/licenseService";
import { QueryType } from "../types";

// Extended AuthenticatedRequest interface to include tracking info
interface TrackingRequest extends AuthenticatedRequest {
  licenseInfo?: {
    license_id: string;
    user_id: string;
    product_slug: string;
    license_type: string;
    agent_access_allowed: boolean;
    queries_remaining?: number;
  };
  queryMetrics?: {
    start_time: number;
    query_type: QueryType;
    endpoint: string;
  };
}

/**
 * Query tracking middleware for license validation and usage monitoring
 */
export const validateQueryLicense = (options: {
  product_slug: string;
  require_agent_access?: boolean;
}) => {
  return async (
    req: TrackingRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { product_slug, require_agent_access = false } = options;

      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
        });
        return;
      }

      const license_key = req.headers["x-license-key"] as string;
      if (!license_key) {
        res.status(400).json({
          success: false,
          error: "License key required",
          code: "MISSING_LICENSE_KEY",
        });
        return;
      }

      // Check if request is from an agent/API client
      const user_agent = req.headers["user-agent"] || "";
      const is_agent_request =
        require_agent_access ||
        !user_agent.includes("Mozilla") ||
        req.headers["x-api-client"] === "agent" ||
        !!req.headers["x-api-key"];

      // Validate license
      const license = await validateLicense(license_key, product_slug);

      if (!license) {
        res.status(403).json({
          success: false,
          error: "License validation failed",
          code: "INVALID_LICENSE",
          details: {
            license_status: "invalid",
            expires_at: null,
          },
        });
        return;
      }

      // Check query limits
      if (license.max_queries && license.query_count >= license.max_queries) {
        res.status(429).json({
          success: false,
          error: "Query limit exceeded for this billing period",
          code: "QUERY_LIMIT_EXCEEDED",
          details: {
            queries_remaining: 0,
            license_type: license.license_type,
            billing_period: license.billing_period,
          },
        });
        return;
      }

      // Check agent access if required
      if (is_agent_request && !license.agent_api_access) {
        res.status(403).json({
          success: false,
          error: "Agent/API access not included in license tier",
          code: "AGENT_ACCESS_DENIED",
          details: {
            license_type: license.license_type,
          },
        });
        return;
      }

      // Store license info in request for tracking
      req.licenseInfo = {
        license_id: license.id,
        user_id: license.user_id,
        product_slug,
        license_type: license.license_type,
        agent_access_allowed: license.agent_api_access,
        queries_remaining: license.max_queries ? license.max_queries - license.query_count : undefined,
      };

      next();
    } catch (error) {
      console.error("License validation error:", error);
      res.status(500).json({
        success: false,
        error: "License validation failed",
        code: "VALIDATION_ERROR",
      });
    }
  };
};

/**
 * Track query execution and usage
 */
export const trackQuery = () => {
  return async (req: TrackingRequest, res: Response, next: NextFunction) => {
    // Store query metrics for tracking
    req.queryMetrics = {
      start_time: Date.now(),
      query_type: "search" as QueryType, // Default, can be overridden
      endpoint: req.originalUrl,
    };

    // Set up response tracking
    const originalSend = res.json;
    res.json = function (data: any) {
      // Track query completion if license info is available
      if (req.licenseInfo && req.queryMetrics) {
        // Query tracking would go here (commented out for now)
        // const response_time_ms = Date.now() - req.queryMetrics.start_time;
        // ... tracking logic
      }
      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Extract query text from request for analytics (currently unused)
 */
// const extractQueryText = (req: TrackingRequest): string | undefined => {
//   return (req.body?.query ||
//     req.query?.q ||
//     req.query?.search ||
//     req.body?.search_query) as string | undefined;
// };

/**
 * Add usage headers to response
 */
export const addUsageHeaders = () => {
  return async (req: TrackingRequest, res: Response, next: NextFunction) => {
    // Set up to add headers after request processing
    const originalSend = res.json;
    res.json = function (data: any) {
      try {
        if (req.licenseInfo) {
          // Usage headers would go here (commented out for now)
          // const usage = await getLicenseUsage(req.licenseInfo.license_id);
          // res.setHeader("X-Queries-Used", usage.queries_used.toString());

          res.setHeader("X-License-Type", req.licenseInfo.license_type);
          res.setHeader(
            "X-Agent-Access",
            req.licenseInfo.agent_access_allowed.toString()
          );
        }
      } catch (error) {
        console.error("Error adding usage headers:", error);
      }
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
    (req: TrackingRequest, res: Response, next: NextFunction) => Promise<void> | void
  > = [
    validateQueryLicense({
      product_slug: options.product_slug,
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
