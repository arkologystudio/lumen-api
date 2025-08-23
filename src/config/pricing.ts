/**
 * Shared Pricing Configuration
 * THIS FILE IS DEPRECATED - All pricing is now in products.config.json
 * Kept for backward compatibility during migration
 */

import { LicenseType } from "../types";
import * as fs from "fs";
import * as path from "path";

/**
 * Load pricing from products.config.json
 * This ensures single source of truth for all pricing data
 */
const loadPricingFromConfig = () => {
  const configPath = path.join(__dirname, "products.config.json");
  const configData = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(configData);
  
  // Map tier names to license types (excluding duplicates from legacy mappings)
  const tierMapping: Record<string, LicenseType[]> = {
    "free": ["free"],
    "standard": ["standard"],
    "pro": ["pro"],
    "premium": ["premium"],
    "enterprise": ["enterprise"]
  };
  
  const pricingConfig: Partial<Record<LicenseType, any>> = {};
  
  // Convert new tier structure to support both new and legacy types
  config.pricingTiers.forEach((tier: any) => {
    const types = tierMapping[tier.tier_name];
    if (types) {
      types.forEach((type: LicenseType) => {
        pricingConfig[type] = {
          monthly_price: tier.monthly_price || 0,
          annual_price: tier.annual_price || 0,
          max_queries: tier.max_queries,
          max_sites: tier.max_sites === -1 ? 10 : tier.max_sites,
          agent_api_access: tier.agent_api_access,
          features: tier.features || [],
          description: tier.description || ""
        };
      });
    }
  });
  
  return pricingConfig as Record<LicenseType, any>;
};

/**
 * Pricing configuration for all license types
 * DEPRECATED: Use products.config.json instead
 */
export const PRICING_CONFIG = loadPricingFromConfig();

/**
 * Add-on pricing configuration
 */
export const ADD_ON_PRICING = {
  extra_site_price: 15, // $15/month per additional site (enterprise only)
  query_overage_price: 0.5, // $0.50 per 100 extra queries (standard/premium only)
  custom_embedding_markup: 15, // 15% markup on base price
}; 