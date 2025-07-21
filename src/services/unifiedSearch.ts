/**
 * Unified search service that handles both posts and products
 * Provides a single interface for multi-content-type search
 */

import { querySimilarSitePosts } from "./multiSiteVectorStore";
import { queryProductSearch } from "./productVectorStore";
import {
  SearchRequest,
  UnifiedSearchResult,
  PostSearchResult,
  ProductSearchResult,
  SearchFilters,
} from "../types";

/**
 * Unified search across both posts and products
 */
export const unifiedSearch = async (
  searchRequest: SearchRequest
): Promise<{
  success: boolean;
  results: UnifiedSearchResult[];
  totalResults: number;
  searchedTypes: string[];
  query: string;
  site_id: string;
}> => {
  const {
    query,
    content_type = "all",
    site_id,
    filters = {},
    limit = 10,
    min_score = 0.0,
  } = searchRequest;

  const results: UnifiedSearchResult[] = [];
  const searchedTypes: string[] = [];

  try {
    // Determine which content types to search
    const searchPosts = content_type === "all" || content_type === "post";
    const searchProducts = content_type === "all" || content_type === "product";

    // Execute searches in parallel
    const promises: Promise<any>[] = [];

    if (searchPosts) {
      searchedTypes.push("post");
      promises.push(
        querySimilarSitePosts(site_id, query, limit)
          .then((postResults) => ({ type: "post", results: postResults }))
          .catch((error) => {
            console.error("Post search error:", error);
            return { type: "post", results: [] };
          })
      );
    }

    if (searchProducts) {
      searchedTypes.push("product");
      promises.push(
        queryProductSearch(site_id, query, filters, limit)
          .then((productResults) => ({
            type: "product",
            results: productResults,
          }))
          .catch((error) => {
            console.error("Product search error:", error);
            return { type: "product", results: [] };
          })
      );
    }

    // Wait for all searches to complete
    const searchResults = await Promise.all(promises);

    // Process and combine results
    for (const searchResult of searchResults) {
      if (searchResult.type === "post") {
        const postResults = searchResult.results as PostSearchResult[];
        for (const post of postResults) {
          if (post.maxScore >= min_score) {
            results.push({
              ...post,
              type: "post" as const,
            });
          }
        }
      } else if (searchResult.type === "product") {
        const productResults = searchResult.results as ProductSearchResult[];
        for (const product of productResults) {
          if (product.score >= min_score) {
            results.push(product);
          }
        }
      }
    }

    // Sort results by score (highest first)
    results.sort((a, b) => {
      const scoreA =
        a.type === "post"
          ? (a as PostSearchResult).maxScore
          : (a as ProductSearchResult).score;
      const scoreB =
        b.type === "post"
          ? (b as PostSearchResult).maxScore
          : (b as ProductSearchResult).score;
      return scoreB - scoreA;
    });

    // Limit final results
    const limitedResults = results.slice(0, limit);

    return {
      success: true,
      results: limitedResults,
      totalResults: limitedResults.length,
      searchedTypes,
      query,
      site_id,
    };
  } catch (error) {
    console.error("Unified search error:", error);
    return {
      success: false,
      results: [],
      totalResults: 0,
      searchedTypes,
      query,
      site_id,
    };
  }
};

/**
 * Get content type-specific statistics for a site
 */
export const getSiteContentStats = async (
  siteId: string
): Promise<{
  site_id: string;
  posts: {
    chunk_count: number;
    exists: boolean;
  };
  products: {
    product_count: number;
    exists: boolean;
  };
}> => {
  try {
    // Import stats functions dynamically to avoid circular dependencies
    const { getSiteStats: getPostStats } = await import(
      "./multiSiteVectorStore"
    );
    const { getProductStats } = await import("./productVectorStore");

    const [postStats, productStats] = await Promise.all([
      getPostStats(siteId).catch(() => ({ chunkCount: 0, exists: false })),
      getProductStats(siteId).catch(() => ({ productCount: 0, exists: false })),
    ]);

    return {
      site_id: siteId,
      posts: {
        chunk_count: postStats.chunkCount || 0,
        exists: postStats.exists || false,
      },
      products: {
        product_count: productStats.productCount || 0,
        exists: productStats.exists || false,
      },
    };
  } catch (error) {
    console.error(`Error getting content stats for site ${siteId}:`, error);
    return {
      site_id: siteId,
      posts: { chunk_count: 0, exists: false },
      products: { product_count: 0, exists: false },
    };
  }
};

/**
 * Content-type aware embedding function
 */
export const getEmbeddingEndpoint = (contentType: "post" | "product") => {
  return contentType === "product"
    ? "/api/products/embed"
    : "/api/embedding/embed";
};

/**
 * Helper to determine optimal search strategy based on query
 */
export const analyzeSearchQuery = (
  query: string
): {
  suggested_content_type: "all" | "post" | "product";
  confidence: number;
  reasoning: string;
} => {
  const lowerQuery = query.toLowerCase();

  // Product indicators
  const productKeywords = [
    "buy",
    "purchase",
    "price",
    "cost",
    "store",
    "shop",
    "product",
    "item",
    "brand",
    "model",
    "specifications",
    "specs",
    "review",
    "rating",
    "size",
    "color",
    "availability",
    "in stock",
    "out of stock",
    "order",
    "cart",
    "shipping",
    "delivery",
    "warranty",
    "discount",
    "sale",
    "offer",
  ];

  // Content/knowledge indicators
  const contentKeywords = [
    "how to",
    "what is",
    "guide",
    "tutorial",
    "learn",
    "understand",
    "explain",
    "article",
    "blog",
    "post",
    "information",
    "knowledge",
    "documentation",
    "help",
    "faq",
    "about",
    "overview",
    "introduction",
  ];

  const productMatches = productKeywords.filter((keyword) =>
    lowerQuery.includes(keyword)
  ).length;
  const contentMatches = contentKeywords.filter((keyword) =>
    lowerQuery.includes(keyword)
  ).length;

  if (productMatches > contentMatches && productMatches > 0) {
    return {
      suggested_content_type: "product",
      confidence: Math.min(productMatches / productKeywords.length, 0.9),
      reasoning: `Query contains ${productMatches} product-related keywords`,
    };
  } else if (contentMatches > productMatches && contentMatches > 0) {
    return {
      suggested_content_type: "post",
      confidence: Math.min(contentMatches / contentKeywords.length, 0.9),
      reasoning: `Query contains ${contentMatches} content-related keywords`,
    };
  } else {
    return {
      suggested_content_type: "all",
      confidence: 0.5,
      reasoning: "Query is ambiguous, searching all content types",
    };
  }
};
