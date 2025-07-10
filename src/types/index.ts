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

// Ecosystem Products (SaaS offerings)
export interface EcosystemProduct {
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
  product?: EcosystemProduct;
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
  products: (SiteProduct & { product: EcosystemProduct })[];
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
