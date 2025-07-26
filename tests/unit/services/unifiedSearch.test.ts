import {
  unifiedSearch,
  getSiteContentStats,
  getEmbeddingEndpoint,
  analyzeSearchQuery,
} from '../../../src/services/unifiedSearch';
import * as multiSiteVectorStore from '../../../src/services/multiSiteVectorStore';
import * as productVectorStore from '../../../src/services/productVectorStore';
import { SearchRequest, PostSearchResult, ProductSearchResult } from '../../../src/types';

// Mock the vector store modules
jest.mock('../../../src/services/multiSiteVectorStore');
jest.mock('../../../src/services/productVectorStore');

const mockedMultiSiteVectorStore = jest.mocked(multiSiteVectorStore);
const mockedProductVectorStore = jest.mocked(productVectorStore);

describe('Unified Search Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('unifiedSearch', () => {
    const mockPostResults: PostSearchResult[] = [
      {
        postId: 1,
        type: 'post',
        postTitle: 'Test Post',
        postUrl: 'https://example.com/post',
        siteId: 'site-123',
        siteName: 'Test Site',
        siteUrl: 'https://example.com',
        averageScore: 0.85,
        maxScore: 0.9,
        totalChunks: 1,
        chunks: [],
      },
    ];

    const mockProductResults: ProductSearchResult[] = [
      {
        id: 1,
        type: 'product',
        title: 'Test Product',
        description: 'Product description',
        url: 'https://example.com/product',
        score: 0.8,
        attributes: {
          price: 99.99,
          currency: 'USD',
        },
        images: [],
        matched_text: 'Product description',
        site_id: 'site-123',
        site_name: 'Test Site',
        site_url: 'https://example.com',
      },
    ];

    it('should search both posts and products when content_type is "all"', async () => {
      mockedMultiSiteVectorStore.querySimilarSitePosts.mockResolvedValue(mockPostResults);
      mockedProductVectorStore.queryProductSearch.mockResolvedValue(mockProductResults);

      const searchRequest: SearchRequest = {
        query: 'test query',
        content_type: 'all',
        site_id: 'site-123',
        limit: 10,
      };

      const result = await unifiedSearch(searchRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.searchedTypes).toEqual(['post', 'product']);
      expect(mockedMultiSiteVectorStore.querySimilarSitePosts).toHaveBeenCalledWith('site-123', 'test query', 10);
      expect(mockedProductVectorStore.queryProductSearch).toHaveBeenCalledWith('site-123', 'test query', {}, 10);
    });

    it('should search only posts when content_type is "post"', async () => {
      mockedMultiSiteVectorStore.querySimilarSitePosts.mockResolvedValue(mockPostResults);

      const searchRequest: SearchRequest = {
        query: 'test query',
        content_type: 'post',
        site_id: 'site-123',
        limit: 10,
      };

      const result = await unifiedSearch(searchRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.searchedTypes).toEqual(['post']);
      expect(mockedMultiSiteVectorStore.querySimilarSitePosts).toHaveBeenCalled();
      expect(mockedProductVectorStore.queryProductSearch).not.toHaveBeenCalled();
    });

    it('should search only products when content_type is "product"', async () => {
      mockedProductVectorStore.queryProductSearch.mockResolvedValue(mockProductResults);

      const searchRequest: SearchRequest = {
        query: 'test query',
        content_type: 'product',
        site_id: 'site-123',
        limit: 10,
      };

      const result = await unifiedSearch(searchRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.searchedTypes).toEqual(['product']);
      expect(mockedProductVectorStore.queryProductSearch).toHaveBeenCalled();
      expect(mockedMultiSiteVectorStore.querySimilarSitePosts).not.toHaveBeenCalled();
    });

    it('should filter results by minimum score', async () => {
      const lowScorePostResults: PostSearchResult[] = [
        {
          ...mockPostResults[0],
          maxScore: 0.3,
        },
      ];

      mockedMultiSiteVectorStore.querySimilarSitePosts.mockResolvedValue(lowScorePostResults);
      mockedProductVectorStore.queryProductSearch.mockResolvedValue(mockProductResults);

      const searchRequest: SearchRequest = {
        query: 'test query',
        content_type: 'all',
        site_id: 'site-123',
        min_score: 0.5,
        limit: 10,
      };

      const result = await unifiedSearch(searchRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1); // Only product result should pass min_score
      expect(result.results[0].type).toBe('product');
    });

    it('should sort results by score in descending order', async () => {
      const multiplePostResults: PostSearchResult[] = [
        { ...mockPostResults[0], maxScore: 0.7 },
        { ...mockPostResults[0], postId: 2, maxScore: 0.9 },
      ];

      mockedMultiSiteVectorStore.querySimilarSitePosts.mockResolvedValue(multiplePostResults);
      mockedProductVectorStore.queryProductSearch.mockResolvedValue([
        { ...mockProductResults[0], score: 0.8 }
      ]);

      const searchRequest: SearchRequest = {
        query: 'test query',
        content_type: 'all',
        site_id: 'site-123',
        limit: 10,
      };

      const result = await unifiedSearch(searchRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      
      // Results should be sorted by score (highest first)
      const scores = result.results.map(r => 
        r.type === 'post' ? (r as PostSearchResult).maxScore : (r as ProductSearchResult).score
      );
      expect(scores).toEqual([0.9, 0.8, 0.7]);
    });

    it('should handle search errors gracefully', async () => {
      mockedMultiSiteVectorStore.querySimilarSitePosts.mockRejectedValue(new Error('Post search failed'));
      mockedProductVectorStore.queryProductSearch.mockResolvedValue(mockProductResults);

      const searchRequest: SearchRequest = {
        query: 'test query',
        content_type: 'all',
        site_id: 'site-123',
        limit: 10,
      };

      const result = await unifiedSearch(searchRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1); // Only product results
      expect(result.results[0].type).toBe('product');
    });

    it('should limit final results', async () => {
      const manyPostResults: PostSearchResult[] = Array.from({ length: 5 }, (_, i) => ({
        ...mockPostResults[0],
        postId: i + 1,
        maxScore: 0.9 - i * 0.1,
      }));

      mockedMultiSiteVectorStore.querySimilarSitePosts.mockResolvedValue(manyPostResults);
      mockedProductVectorStore.queryProductSearch.mockResolvedValue(mockProductResults);

      const searchRequest: SearchRequest = {
        query: 'test query',
        content_type: 'all',
        site_id: 'site-123',
        limit: 3,
      };

      const result = await unifiedSearch(searchRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
    });

    it('should handle complete search failure', async () => {
      mockedMultiSiteVectorStore.querySimilarSitePosts.mockRejectedValue(new Error('Complete failure'));
      mockedProductVectorStore.queryProductSearch.mockRejectedValue(new Error('Complete failure'));

      const searchRequest: SearchRequest = {
        query: 'test query',
        content_type: 'all',
        site_id: 'site-123',
        limit: 10,
      };

      const result = await unifiedSearch(searchRequest);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.totalResults).toBe(0);
    });
  });

  describe('getSiteContentStats', () => {
    it('should return stats for both posts and products', async () => {
      // Mock the dynamic import functions directly
      mockedMultiSiteVectorStore.getSiteStats = jest.fn().mockResolvedValue({
        chunkCount: 10,
        exists: true,
      });

      mockedProductVectorStore.getProductStats = jest.fn().mockResolvedValue({
        productCount: 5,
        exists: true,
      });

      const result = await getSiteContentStats('site-123');

      expect(result).toEqual({
        site_id: 'site-123',
        posts: {
          chunk_count: 10,
          exists: true,
        },
        products: {
          product_count: 5,
          exists: true,
        },
      });
    });
  });

  describe('getEmbeddingEndpoint', () => {
    it('should return product endpoint for product content type', () => {
      const endpoint = getEmbeddingEndpoint('product');
      expect(endpoint).toBe('/api/products/embed');
    });

    it('should return post endpoint for post content type', () => {
      const endpoint = getEmbeddingEndpoint('post');
      expect(endpoint).toBe('/api/embedding/embed');
    });
  });

  describe('analyzeSearchQuery', () => {
    it('should suggest product search for product-related queries', () => {
      const analysis = analyzeSearchQuery('buy laptop with best price');

      expect(analysis.suggested_content_type).toBe('product');
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.reasoning).toContain('product-related keywords');
    });

    it('should suggest post search for content-related queries', () => {
      const analysis = analyzeSearchQuery('how to learn programming tutorial');

      expect(analysis.suggested_content_type).toBe('post');
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.reasoning).toContain('content-related keywords');
    });

    it('should suggest all content types for ambiguous queries', () => {
      const analysis = analyzeSearchQuery('javascript');

      expect(analysis.suggested_content_type).toBe('all');
      expect(analysis.confidence).toBe(0.5);
      expect(analysis.reasoning).toContain('ambiguous');
    });

    it('should handle empty queries', () => {
      const analysis = analyzeSearchQuery('');

      expect(analysis.suggested_content_type).toBe('all');
      expect(analysis.confidence).toBe(0.5);
    });

    it('should handle queries with both product and content keywords', () => {
      const analysis = analyzeSearchQuery('how to buy tutorial');

      // Should favor one or the other based on keyword count
      expect(['post', 'product', 'all']).toContain(analysis.suggested_content_type);
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
    });
  });
});