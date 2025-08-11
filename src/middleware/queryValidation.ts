/**
 * Query Validation Middleware
 * Enforces license-based query limits and tracks usage
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";
import { prisma } from "../config/database";
import { validateLicense, trackQueryUsage } from "../services/licenseService";

/**
 * Middleware to validate license and enforce query limits
 * Should be used after authentication middleware
 */
export const validateQueryLicense = (productSlug?: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Check if license key is provided in headers
      const licenseKey = req.headers['x-license-key'] as string;
      
      if (!licenseKey) {
        res.status(400).json({
          success: false,
          error: "License key required",
          message: "Please provide a valid license key in the 'X-License-Key' header",
        });
        return;
      }

      // If no specific product slug provided, find any valid license for this key
      let license;
      if (productSlug) {
        // Validate for specific product
        license = await validateLicense(licenseKey, productSlug);
      } else {
        // Find any active license with this key
        const prismaLicense = await prisma.license.findFirst({
          where: {
            license_key: licenseKey,
            status: "active",
            is_active: true,
          },
          include: {
            user: true,
            product: true,
          },
        });
        
        if (prismaLicense) {
          // Check if license is expired
          if (prismaLicense.expires_at && new Date(prismaLicense.expires_at) < new Date()) {
            license = null;
          } else {
            // Use the product slug from the found license
            license = await validateLicense(licenseKey, prismaLicense.product.slug);
          }
        }
      }
      
      if (!license) {
        res.status(403).json({
          success: false,
          error: "Invalid or expired license",
          message: "The provided license key is invalid, expired, or not authorized for this product",
        });
        return;
      }

      // Check if license has expired
      if (license.expires_at && new Date(license.expires_at) < new Date()) {
        res.status(403).json({
          success: false,
          error: "License expired",
          message: "Your license has expired. Please renew your subscription.",
        });
        return;
      }

      // Check query limits (if not enterprise/unlimited)
      if (license.max_queries !== null) {
        // Check if we need to reset the query period
        const now = new Date();
        const queryPeriodEnd = license.query_period_end ? new Date(license.query_period_end) : null;
        
        if (queryPeriodEnd && now > queryPeriodEnd) {
          // Reset query period and count
          await prisma.license.update({
            where: { id: license.id },
            data: {
              query_count: 0,
              query_period_start: now,
              query_period_end: calculateNextPeriodEnd(now, license.billing_period),
            },
          });
          // Update the license object for current request
          license.query_count = 0;
          license.query_period_start = now.toISOString();
          license.query_period_end = calculateNextPeriodEnd(now, license.billing_period).toISOString();
        }

        // Check if query limit is exceeded
        if (license.query_count >= (license.max_queries || 0)) {
          res.status(429).json({
            success: false,
            error: "Query limit exceeded",
            message: `You have exceeded your query limit of ${license.max_queries} for this billing period`,
            usage: {
              current: license.query_count,
              limit: license.max_queries,
              period_end: license.query_period_end,
            },
          });
          return;
        }
      }

      // Check API access permissions for agent requests
      const isAgentRequest = req.headers['x-agent-id'] || req.headers['user-agent']?.includes('bot');
      if (isAgentRequest && !license.agent_api_access) {
        res.status(403).json({
          success: false,
          error: "Agent access not permitted",
          message: "Your license does not include agent/API access. Please upgrade to a Plus or Enterprise tier.",
        });
        return;
      }

      // Add license info to request for controllers to use
      req.license = license;
      
      // Add usage headers to response
      const remainingQueries = license.max_queries ? 
        Math.max(0, license.max_queries - license.query_count - 1) : // -1 for current query
        null;

      res.set({
        'X-Query-Usage-Current': String(license.query_count + 1),
        'X-Query-Usage-Limit': license.max_queries ? String(license.max_queries) : 'unlimited',
        'X-Query-Usage-Remaining': remainingQueries ? String(remainingQueries) : 'unlimited',
        'X-Query-Period-End': license.query_period_end || '',
        'X-License-Type': license.license_type,
        'X-Agent-Access': String(license.agent_api_access),
      });

      next();
    } catch (error) {
      console.error("Query validation error:", error);
      res.status(500).json({
        success: false,
        error: "License validation failed",
        message: "An error occurred while validating your license",
      });
    }
  };
};

/**
 * Calculate the next billing period end date
 */
function calculateNextPeriodEnd(start: Date, billingPeriod: string): Date {
  const end = new Date(start);
  
  switch (billingPeriod) {
    case "monthly":
      end.setMonth(end.getMonth() + 1);
      break;
    case "annual":
      end.setFullYear(end.getFullYear() + 1);
      break;
    default:
      // Default to monthly
      end.setMonth(end.getMonth() + 1);
      break;
  }
  
  return end;
}

/**
 * Middleware to track query usage after successful request
 * Should be used after the main request handler
 */
export const trackQuery = () => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Store original end method
    const originalEnd = res.end;
    
    // Override end method to track usage
    res.end = function(chunk: any, encoding?: any): any {
      // Only track if we have a license and the request was successful
      if (req.license && res.statusCode >= 200 && res.statusCode < 300) {
        // Track usage asynchronously (don't block response)
        setImmediate(async () => {
          try {
            const isAgentRequest = !!(req.headers['x-agent-id'] || req.headers['user-agent']?.includes('bot'));
            
            await trackQueryUsage(req.license!.id, {
              site_id: req.params.site_id,
              query_type: 'search',
              endpoint: req.route?.path || req.path,
              query_text: req.body?.query,
              ip_address: req.ip,
              user_agent: req.headers['user-agent'],
              is_agent_request: isAgentRequest,
              response_time_ms: Date.now() - (req as any).startTime,
              results_count: (res as any).resultsCount || 0,
              billable: true,
            });
          } catch (error) {
            console.error("Error tracking query usage:", error);
            // Don't throw - this is background tracking
          }
        });
      }
      
      // Call original end method
      return originalEnd.call(this, chunk, encoding);
    };
    
    // Store request start time for response time calculation
    (req as any).startTime = Date.now();
    
    next();
  };
};

/**
 * Helper middleware to set results count for tracking
 */
export const setResultsCount = (count: number) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    (res as any).resultsCount = count;
    next();
  };
};