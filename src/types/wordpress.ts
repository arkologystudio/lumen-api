export interface EmbedRequest {
  id: number;
  type: string;
  title: string;
  content: string;
  url: string;
  // Site identification
  site_id: string;
  site_name?: string;
  site_url?: string;
  // Chunking fields (optional - only present for chunked posts)
  is_chunked?: boolean;
  chunk_id?: string;
  chunk_index?: number;
  total_chunks?: number;
}

export interface EmbedBatchRequest {
  site_id: string;
  site_name?: string;
  site_url?: string;
  posts: EmbedRequest[];
}

export interface SiteConfig {
  site_id: string;
  site_name: string;
  site_url: string;
  collection_name: string;
  created_at: string;
  updated_at: string;
  post_count?: number;
  chunk_count?: number;
}
