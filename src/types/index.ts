import { EmbedRequest } from "./wordpress";

export interface BlockAttributes {
  [key: string]: unknown;
  id: string;
}

export interface GutenbergBlock {
  blockName: string | null;
  attrs: BlockAttributes;
  innerBlocks: GutenbergBlock[];
  innerHTML: string;
  innerContent: (string | null)[];
}

export interface Block {
  id: number;
  title: string;
  content: string;
  status: string;
  parent: number | null;
  order: number;
  type: string;
  metadata: Record<string, unknown>;
}

export interface CurriculumModule {
  id: number;
  permalink: string;
  blocks: GutenbergBlock[];
  title: string;
}

// WordPress REST API response types
export interface WPPostResponse {
  id: number;
  permalink?: string;
  content?: string;
  blocks?: GutenbergBlock[];
  title?: string;
}

// User Management Types
export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  subscription_tier?: "free" | "pro" | "enterprise";
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

// Site Management Types
export interface Site {
  id: string;
  user_id: string;
  name: string;
  url: string;
  description?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  embedding_status: "not_started" | "in_progress" | "completed" | "failed";
  last_embedding_at?: string;
  post_count: number;
  chunk_count: number;
}

export interface CreateSiteRequest {
  name: string;
  url: string;
  description?: string;
}

export interface UpdateSiteRequest {
  name?: string;
  url?: string;
  description?: string;
  is_active?: boolean;
}

// Enhanced Auth Types
export interface AuthPayload {
  jti: string;
  user_id: string;
  email: string;
}

export interface AuthResponse {
  user: Omit<User, "created_at" | "updated_at">;
  token: string;
  expires_in: number;
}

// Search and Embedding Types (enhanced)
export interface BasicSearchRequest {
  query: string;
  topK?: number;
  site_id: string;
}

export interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  site_id: string;
  totalPosts: number;
  totalChunks: number;
  query: string;
}

export interface SearchResult {
  postId: number;
  postTitle: string;
  postUrl: string;
  siteId: string;
  siteName?: string;
  siteUrl?: string;
  averageScore: number;
  maxScore: number;
  totalChunks: number;
  chunks: SearchResultChunk[];
}

export interface SearchResultChunk {
  chunkId: string;
  chunkIndex: number;
  content: string;
  score: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Database-related types
export interface UserWithSites extends User {
  sites: Site[];
}

export interface SiteWithUser extends Site {
  user: User;
}

// Embedding Job Types (for tracking long-running operations)
export interface EmbeddingJob {
  id: string;
  site_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  started_at: string;
  completed_at?: string;
  error_message?: string;
  posts_count: number;
  chunks_count: number;
  metadata?: Record<string, any>;
}

// Content Type Definitions
export type ContentType = "post" | "product";

// Base content interface
export interface BaseContent {
  id: number;
  type: ContentType;
  title: string;
  url: string;
  site_id: string;
  site_name?: string;
  site_url?: string;
}

// Product-specific interfaces
export interface ProductAttributes {
  price?: number;
  currency?: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  rating?: number;
  reviews_count?: number;
  availability?: "in_stock" | "out_of_stock" | "limited" | "pre_order";
  specifications?: Record<string, string | number | boolean>;
  tags?: string[];
  sku?: string;
  weight?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  };
}

export interface ProductContent extends BaseContent {
  type: "product";
  description: string;
  short_description?: string;
  attributes: ProductAttributes;
  images?: string[];
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  name: string;
  price?: number;
  sku?: string;
  attributes: Record<string, string | number>;
  availability?: ProductAttributes["availability"];
  image?: string;
}

// Extended embed request for products
export interface ProductEmbedRequest extends BaseContent {
  type: "product";
  description: string;
  short_description?: string;
  attributes: ProductAttributes;
  images?: string[];
  // Computed fields for embedding
  searchable_text?: string;
  attribute_text?: string;
}

// Unified content request
export type ContentEmbedRequest = EmbedRequest | ProductEmbedRequest;

// Search request types
export interface SearchRequest {
  query: string;
  content_type?: ContentType | "all";
  site_id: string;
  filters?: SearchFilters;
  limit?: number;
  min_score?: number;
}

export interface SearchFilters {
  // Product-specific filters
  price_min?: number;
  price_max?: number;
  brand?: string[];
  category?: string[];
  rating_min?: number;
  availability?: ProductAttributes["availability"][];
  attributes?: Record<string, string | number | boolean>;
  // Post-specific filters
  date_from?: string;
  date_to?: string;
  author?: string;
  tags?: string[];
}

// Search result types
export interface ProductSearchResult {
  id: number;
  type: "product";
  title: string;
  description: string;
  url: string;
  score: number;
  attributes: ProductAttributes;
  images?: string[];
  matched_text: string;
  site_id: string;
  site_name?: string;
  site_url?: string;
}

export interface PostSearchResult {
  postId: number;
  type: "post";
  postTitle: string;
  postUrl: string;
  siteId: string;
  siteName?: string;
  siteUrl?: string;
  averageScore: number;
  maxScore: number;
  totalChunks: number;
  chunks: Array<{
    chunkId: string;
    chunkIndex: number;
    content: string;
    score: number;
  }>;
}

export type UnifiedSearchResult = ProductSearchResult | PostSearchResult;

// Products (unified from EcosystemProduct and Plugin)
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  version: string;
  is_active: boolean;
  is_beta: boolean;
  base_price?: number;
  usage_based: boolean;
  features?: string[];
  limits?: Record<string, any>;
  extended_documentation?: string;
  
  // File information (for downloadable products)
  filename?: string;
  file_path?: string;
  file_size?: number;
  file_hash?: string;
  content_type?: string;
  is_public?: boolean;
  
  // Release information
  release_notes?: string;
  changelog?: string;
  max_downloads?: number;
  
  created_at: string;
  updated_at: string;
}

export interface SiteProduct {
  id: string;
  site_id: string;
  product_id: string;
  is_enabled: boolean;
  enabled_at: string;
  disabled_at?: string;
  config?: Record<string, any>;
  usage_limits?: Record<string, any>;
  last_used_at?: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface SiteWithProducts extends Site {
  site_products: SiteProduct[];
}

// API Request/Response types for ecosystem products
export interface RegisterSiteProductRequest {
  product_slug: string;
  config?: Record<string, any>;
}

export interface UpdateSiteProductRequest {
  is_enabled?: boolean;
  config?: Record<string, any>;
  usage_limits?: Record<string, any>;
}

export interface SiteProductsResponse {
  products: (SiteProduct & { product: Product })[];
  total: number;
}

// Activity Log Types
export interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  title: string;
  description?: string;
  site_id?: string;
  target_id?: string;
  target_type?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  user?: User;
  site?: Site;
}

export interface CreateActivityRequest {
  user_id: string;
  activity_type: string;
  title: string;
  description?: string;
  site_id?: string;
  target_id?: string;
  target_type?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export interface ActivityLogResponse {
  activities: ActivityLog[];
  total: number;
  has_more: boolean;
}

// Plugin Licensing Types
export interface License {
  id: string;
  user_id: string;
  product_id: string;
  license_key: string;
  license_type: LicenseType;
  status: LicenseStatus;
  is_active: boolean;

  // Billing information
  billing_period: BillingPeriod;
  amount_paid?: number;
  currency: string;

  // Validity period
  issued_at: string;
  expires_at?: string;
  last_validated?: string;

  // Feature permissions
  agent_api_access: boolean;
  max_sites: number;

  // Usage tracking and limits
  download_count: number;
  max_downloads?: number;
  query_count: number;
  max_queries?: number;
  query_period_start: string;
  query_period_end?: string;

  // Add-ons
  additional_sites: number;
  custom_embedding: boolean;

  // Metadata
  purchase_reference?: string;
  notes?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;

  // Relationships
  user?: User;
  product?: Product;
  query_usage?: QueryUsage[];
}

export interface Download {
  id: string;
  user_id: string;
  product_id: string;
  license_id: string;
  download_url?: string;
  download_token?: string;
  token_expires?: string;
  ip_address?: string;
  user_agent?: string;
  referer?: string;
  status: DownloadStatus;
  started_at: string;
  completed_at?: string;
  bytes_downloaded?: number;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: string;
  user?: User;
  product?: Product;
  license?: License;
}

export interface QueryUsage {
  id: string;
  user_id: string;
  license_id: string;
  site_id?: string;

  // Query details
  query_type: QueryType;
  endpoint: string;
  query_text?: string;

  // Request metadata
  ip_address?: string;
  user_agent?: string;
  is_agent_request: boolean;

  // Performance metrics
  response_time_ms?: number;
  results_count?: number;

  // Billing
  billable: boolean;

  // Timestamps
  created_at: string;

  // Relationships
  user?: User;
  license?: License;
  site?: Site;
}

export interface PricingTier {
  id: string;
  product_id: string;

  // Tier details
  tier_name: string;
  display_name: string;
  description: string;

  // Pricing
  monthly_price: number;
  annual_price: number;

  // Features and limits
  max_queries?: number;
  max_sites: number;
  agent_api_access: boolean;

  // Add-on pricing
  extra_site_price?: number;
  overage_price?: number;
  custom_embedding_markup?: number;

  // Metadata
  features?: string[];
  is_active: boolean;
  sort_order: number;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Relationships
  product?: Product;
}

// Plugin Management Request/Response Types (now merged into Product)
export interface CreateProductRequest {
  name: string;
  slug: string;
  description: string;
  category: string;
  version?: string;
  is_active?: boolean;
  is_beta?: boolean;
  base_price?: number;
  usage_based?: boolean;
  features?: string[];
  limits?: Record<string, any>;
  extended_documentation?: string;
  
  // File information (for downloadable products)
  filename?: string;
  content_type?: string;
  is_public?: boolean;
  release_notes?: string;
  changelog?: string;
  max_downloads?: number;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  version?: string;
  is_active?: boolean;
  is_beta?: boolean;
  base_price?: number;
  usage_based?: boolean;
  features?: string[];
  limits?: Record<string, any>;
  extended_documentation?: string;
  is_public?: boolean;
  release_notes?: string;
  changelog?: string;
  max_downloads?: number;
}

// License Management Request/Response Types
export interface CreateLicenseRequest {
  user_id: string;
  product_slug: string;
  license_type: LicenseType;
  billing_period?: BillingPeriod;
  max_downloads?: number;
  max_queries?: number;
  additional_sites?: number;
  custom_embedding?: boolean;
  purchase_reference?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UpdateLicenseRequest {
  license_type?: LicenseType;
  status?: LicenseStatus;
  billing_period?: BillingPeriod;
  expires_at?: string;
  max_downloads?: number;
  max_queries?: number;
  agent_api_access?: boolean;
  max_sites?: number;
  additional_sites?: number;
  custom_embedding?: boolean;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ValidateLicenseRequest {
  license_key: string;
  product_slug?: string;
  check_agent_access?: boolean;
  site_id?: string;
}

export interface ValidateLicenseResponse {
  valid: boolean;
  license?: License;
  message?: string;
  download_allowed: boolean;
  query_allowed: boolean;
  agent_access_allowed: boolean;
  queries_remaining?: number;
  sites_remaining?: number;
}

// Purchase Request/Response Types
export interface PurchaseRequest {
  product_slug: string;
  license_type: LicenseType;
  billing_period?: BillingPeriod;
  additional_sites?: number;
  custom_embedding?: boolean;
}

export interface SimulatePurchaseRequest extends PurchaseRequest {
  user_id?: string;
  payment_reference?: string;
}

export interface PurchaseResponse {
  success: boolean;
  purchase: {
    purchase_reference: string;
    product: Product;
    license: License;
    pricing_tier: PricingTier;
  };
  message: string;
}

export interface SimulatePurchaseResponse extends PurchaseResponse {}

// Download Request/Response Types
export interface InitiateDownloadRequest {
  product_slug: string;
  license_key: string;
}

export interface InitiateDownloadResponse {
  success: boolean;
  download_token: string;
  expires_at: string;
  plugin: {
    name: string;
    filename: string;
    file_size: number;
    version: string;
  };
  message?: string;
}

export interface DownloadWithTokenRequest {
  download_token: string;
}

// Admin Gift License Types
export interface GiftLicenseRequest {
  user_id: string;
  product_slug: string;
  license_type: LicenseType;
  billing_period?: BillingPeriod;
  additional_sites?: number;
  custom_embedding?: boolean;
  notes?: string;
}

// Plugin and License Statistics Types
export interface ProductStats {
  total_downloads: number;
  active_licenses: number;
  total_licenses: number;
  download_trend: Array<{
    date: string;
    downloads: number;
  }>;
}

export interface UserLicenseStats {
  total_licenses: number;
  active_licenses: number;
  expired_licenses: number;
  downloads_used: number;
  downloads_remaining: number;
  queries_used: number;
  queries_remaining: number;
  licenses_by_type: Record<LicenseType, number>;
  licenses_by_status: Record<LicenseStatus, number>;
}

// Extended Product types with Pricing information
export interface ProductWithPricing extends Product {
  pricing_tiers: PricingTier[];
  has_license: boolean;
  license_status?: LicenseStatus;
  current_tier?: string;
}

// Pricing and Billing Types
export interface AvailableProductResponse {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  features?: string[];
  pricing_tiers: PricingTier[];
  has_license: boolean;
  license_status?: LicenseStatus;
  current_tier?: string;
}

export interface PurchaseHistoryItem {
  purchase_reference: string;
  product_name: string;
  license_type: LicenseType;
  billing_period: BillingPeriod;
  amount_paid: number;
  purchased_at: string;
  license: License;
}

export interface QueryTrackingRequest {
  query_type: QueryType;
  endpoint: string;
  query_text?: string;
  site_id?: string;
  is_agent_request?: boolean;
  response_time_ms?: number;
  results_count?: number;
}

export interface LicenseUsageResponse {
  queries_used: number;
  queries_remaining?: number;
  query_period_start: string;
  query_period_end?: string;
  downloads_used: number;
  downloads_remaining?: number;
  sites_used: number;
  sites_remaining: number;
  agent_access_enabled: boolean;
  custom_embedding_enabled: boolean;
}

// License Status Types
export type LicenseStatus = "active" | "expired" | "revoked" | "suspended";
export type LicenseType =
  | "trial" // Legacy: maps to "free"
  | "free"
  | "standard"
  | "standard_plus" // Legacy: maps to "pro"
  | "pro"
  | "premium"
  | "premium_plus" // Legacy: kept for compatibility
  | "enterprise";
export type BillingPeriod = "monthly" | "annual";
export type QueryType = "search" | "embed" | "analysis";
export type DownloadStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "expired";
