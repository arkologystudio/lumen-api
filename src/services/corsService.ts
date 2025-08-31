/**
 * CORS Service
 * Manages dynamic CORS origins based on registered sites in the database
 */

import { prisma } from "../config/database";

interface CorsCache {
  origins: string[];
  lastUpdated: number;
}

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let corsCache: CorsCache | null = null;

/**
 * Normalizes a URL for consistent CORS matching
 * - Removes trailing slashes
 * - Converts to lowercase
 * - Ensures protocol is included
 */
export function normalizeUrl(url: string): string {
  try {
    // Handle URLs without protocol
    let normalizedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // For localhost, default to http instead of https
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        normalizedUrl = `http://${url}`;
      } else {
        normalizedUrl = `https://${url}`;
      }
    }

    const urlObj = new URL(normalizedUrl);
    
    // Return origin (protocol + hostname + port)
    return urlObj.origin.toLowerCase();
  } catch (error) {
    console.warn(`Invalid URL format: ${url}`);
    return url.toLowerCase().replace(/\/$/, '');
  }
}

/**
 * Extract the base domain from a URL (handles subdomains)
 */
function getBaseDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove 'www.' prefix if present
    const hostname = urlObj.hostname.replace(/^www\./, '');
    return hostname.toLowerCase();
  } catch (error) {
    return '';
  }
}

/**
 * Fetches all active site URLs from the database and creates variations
 */
async function fetchActiveSiteOrigins(): Promise<string[]> {
  try {
    const sites = await prisma.site.findMany({
      where: {
        is_active: true,
      },
      select: {
        url: true,
      },
    });

    const originsSet = new Set<string>();

    // For each site, add multiple variations to handle protocol and subdomain differences
    for (const site of sites) {
      const baseDomain = getBaseDomain(site.url);
      if (baseDomain) {
        // Add variations with different protocols and www/non-www
        const variations = [
          `http://${baseDomain}`,
          `https://${baseDomain}`,
          `http://www.${baseDomain}`,
          `https://www.${baseDomain}`,
        ];

        // Also add the original normalized URL
        try {
          originsSet.add(normalizeUrl(site.url));
        } catch (error) {
          console.warn(`Could not normalize URL: ${site.url}`);
        }

        // Add all variations
        for (const variation of variations) {
          originsSet.add(variation);
        }
      }
    }

    return Array.from(originsSet);
  } catch (error) {
    console.error("Error fetching site origins:", error);
    return [];
  }
}

/**
 * Gets allowed CORS origins with caching
 */
export async function getAllowedOrigins(): Promise<string[]> {
  const now = Date.now();
  
  // Return cached origins if cache is still valid
  if (corsCache && (now - corsCache.lastUpdated) < CACHE_TTL_MS) {
    return corsCache.origins;
  }

  // Fetch fresh origins
  const siteOrigins = await fetchActiveSiteOrigins();
  
  // Update cache
  corsCache = {
    origins: siteOrigins,
    lastUpdated: now,
  };

  return siteOrigins;
}

/**
 * Clears the CORS cache (useful for testing or immediate updates)
 */
export function clearCorsCache(): void {
  corsCache = null;
}

/**
 * CORS origin validation function for use with express cors middleware
 */
export function createDynamicOriginHandler(staticOrigins: string[] = []) {
  // Normalize static origins once at startup
  const normalizedStaticOrigins = staticOrigins
    .filter(origin => origin) // Filter out any undefined/null values
    .map(origin => {
      try {
        const normalized = normalizeUrl(origin);
        console.log(`CORS: Static origin "${origin}" normalized to "${normalized}"`);
        return normalized;
      } catch (error) {
        console.warn(`Invalid static origin: ${origin}`, error);
        return null;
      }
    })
    .filter(origin => origin !== null) as string[];

  console.log('CORS: Initialized with static origins:', normalizedStaticOrigins);

  return async (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
    // Allow requests with no origin (mobile apps, postman, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }

    try {
      // Normalize the incoming origin
      const normalizedOrigin = normalizeUrl(origin);
      console.log(`CORS: Checking origin "${origin}" (normalized: "${normalizedOrigin}")`);
      
      // Check static origins first (dashboard, etc.)
      if (normalizedStaticOrigins.includes(normalizedOrigin)) {
        console.log(`CORS: Allowed static origin: ${origin}`);
        callback(null, origin); // Return the actual origin instead of just 'true'
        return;
      }

      // Check dynamic origins from database
      const allowedOrigins = await getAllowedOrigins();
      const isAllowed = allowedOrigins.includes(normalizedOrigin);
      
      if (isAllowed) {
        console.log(`CORS: Allowed registered site origin: ${origin}`);
        callback(null, origin); // Return the actual origin instead of just 'true'
      } else {
        console.warn(`CORS: Blocked unregistered origin: ${origin}`);
        console.warn(`  Normalized as: ${normalizedOrigin}`);
        console.warn(`  Allowed origins from DB: ${allowedOrigins.join(', ')}`);
        callback(null, false);
      }
    } catch (error) {
      console.error("CORS origin validation error:", error);
      console.error(`  Failed to validate origin: ${origin}`);
      // On error, fall back to rejecting the origin for security
      callback(null, false);
    }
  };
}