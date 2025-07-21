/**
 * Shared Pricing Configuration
 * Centralized pricing tiers and add-on pricing to avoid duplication
 */

import { LicenseType } from "../types";

/**
 * Pricing configuration for all license types
 */
export const PRICING_CONFIG: Record<
  LicenseType,
  {
    monthly_price: number;
    annual_price: number;
    max_queries: number | null;
    max_sites: number;
    agent_api_access: boolean;
    features: string[];
    description: string;
  }
> = {
  trial: {
    monthly_price: 0,
    annual_price: 0,
    max_queries: 50,
    max_sites: 1,
    agent_api_access: false,
    features: ["Basic search", "50 queries/month", "Single site"],
    description:
      "Basic semantic search for a single site's knowledge base or product catalog via the human-facing UI.",
  },
  standard: {
    monthly_price: 19,
    annual_price: 205,
    max_queries: 100,
    max_sites: 1,
    agent_api_access: false,
    features: [
      "Semantic search",
      "100 queries/month",
      "Single site",
      "Human UI access",
    ],
    description:
      "Basic semantic search for a single site's knowledge base or product catalog via the human-facing UI.",
  },
  standard_plus: {
    monthly_price: 24,
    annual_price: 259,
    max_queries: 100,
    max_sites: 1,
    agent_api_access: true,
    features: [
      "Semantic search",
      "100 queries/month",
      "Single site",
      "Human UI access",
      "Agent/API access",
    ],
    description:
      "Everything in Standard, plus programmatic access (agent/API) so bots and AI agents can query your content.",
  },
  premium: {
    monthly_price: 49,
    annual_price: 529,
    max_queries: 2000,
    max_sites: 1,
    agent_api_access: false,
    features: [
      "Advanced search",
      "2000 queries/month",
      "Single site",
      "Human UI access",
      "Priority support",
    ],
    description:
      "Higher-volume plan for growing sites that need more monthly queries, still UI-only.",
  },
  premium_plus: {
    monthly_price: 59,
    annual_price: 637,
    max_queries: 2000,
    max_sites: 1,
    agent_api_access: true,
    features: [
      "Advanced search",
      "2000 queries/month",
      "Single site",
      "Human UI access",
      "Agent/API access",
      "Priority support",
    ],
    description:
      "All Premium features, with agent/API access for integrations and autonomous agents.",
  },
  enterprise: {
    monthly_price: 199,
    annual_price: 2149,
    max_queries: null,
    max_sites: 10,
    agent_api_access: true,
    features: [
      "Unlimited queries",
      "Up to 10 sites",
      "Agent/API access",
      "Priority support",
      "Custom SLA",
      "Dedicated onboarding",
    ],
    description:
      "Unlimited queries and multi-site support, with white-glove SLAs and priority support.",
  },
};

/**
 * Add-on pricing configuration
 */
export const ADD_ON_PRICING = {
  extra_site_price: 15, // $15/month per additional site (enterprise only)
  query_overage_price: 0.5, // $0.50 per 100 extra queries (standard/premium only)
  custom_embedding_markup: 15, // 15% markup on base price
}; 