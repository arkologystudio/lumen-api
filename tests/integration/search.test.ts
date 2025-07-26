import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/config/database';
import * as embeddingService from '../../src/services/embedding';
import * as unifiedSearchService from '../../src/services/unifiedSearch';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/embedding');
jest.mock('../../src/services/unifiedSearch');
jest.mock('../../src/services/supabaseStorage', () => ({
  initializeStorage: jest.fn().mockResolvedValue(undefined),
}));

const mockedPrisma = jest.mocked(prisma);
const mockedEmbeddingService = jest.mocked(embeddingService);
const mockedUnifiedSearchService = jest.mocked(unifiedSearchService);

describe('Search Integration Tests', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password_hash: '$2b$12$validHashHere',
    created_at: new Date(),
    updated_at: new Date(),
    is_active: true,
    subscription_tier: 'free',
    stripe_customer_id: null,
    current_period_end: null,
    trial_end: null,
  };

  const mockSite = {
    id: 'site-123',
    user_id: 'user-123',
    name: 'Test Site',
    url: 'https://example.com',
    description: null,
    created_at: new Date(),
    updated_at: new Date(),
    is_active: true,
    embedding_status: 'completed',
    last_embedding_at: new Date(),
    post_count: 10,
    chunk_count: 50,
  };

  const mockAuthToken = 'valid-jwt-token';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock JWT verification
    const jwt = require('jsonwebtoken');
    jest.spyOn(jwt, 'verify').mockReturnValue({
      jti: 'token-id',
      user_id: 'user-123',
      email: 'test@example.com',
    });

    // Mock user lookup
    mockedPrisma.user.findUnique.mockResolvedValue(mockUser);
  });

  describe('POST /api/embedding/embed', () => {
    const embedRequest = {
      text: 'test content to embed',
      site_id: 'site-123',
    };

    it('should embed text successfully', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      
      mockedPrisma.site.findUnique.mockResolvedValue(mockSite);
      mockedEmbeddingService.embedText.mockResolvedValue(mockEmbedding);

      const response = await request(app)
        .post('/api/embedding/embed')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(embedRequest)
        .expect(200);

      expect(response.body).toHaveProperty('embedding');
      expect(response.body.embedding).toEqual(mockEmbedding);
      expect(response.body).toHaveProperty('dimensions');
      expect(response.body.dimensions).toBe(5);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/embedding/embed')
        .send(embedRequest)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 for unauthorized site access', async () => {
      const unauthorizedSite = {
        ...mockSite,
        user_id: 'other-user-id', // Different user
      };

      mockedPrisma.site.findUnique.mockResolvedValue(unauthorizedSite);

      const response = await request(app)
        .post('/api/embedding/embed')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(embedRequest)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Not authorized');
    });

    it('should return 404 for non-existent site', async () => {
      mockedPrisma.site.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/embedding/embed')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(embedRequest)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Site not found');
    });

    it('should return 400 for missing text', async () => {
      const response = await request(app)
        .post('/api/embedding/embed')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({ site_id: 'site-123' }) // Missing text
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle embedding service errors', async () => {
      mockedPrisma.site.findUnique.mockResolvedValue(mockSite);
      mockedEmbeddingService.embedText.mockRejectedValue(new Error('Embedding failed'));

      const response = await request(app)
        .post('/api/embedding/embed')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(embedRequest)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/embedding/search', () => {
    const searchRequest = {
      query: 'test search query',
      site_id: 'site-123',
      content_type: 'all',
      limit: 10,
    };

    const mockSearchResults = {
      success: true,
      results: [
        {
          postId: 1,
          type: 'post' as const,
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
        {
          id: 2,
          type: 'product' as const,
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
      ],
      totalResults: 2,
      searchedTypes: ['post', 'product'],
      query: 'test search query',
      site_id: 'site-123',
    };

    it('should perform unified search successfully', async () => {
      mockedPrisma.site.findUnique.mockResolvedValue(mockSite);
      mockedUnifiedSearchService.unifiedSearch.mockResolvedValue(mockSearchResults);

      const response = await request(app)
        .post('/api/embedding/search')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(searchRequest)
        .expect(200);

      expect(response.body).toEqual(mockSearchResults);
      expect(mockedUnifiedSearchService.unifiedSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test search query',
          site_id: 'site-123',
          content_type: 'all',
          limit: 10,
        })
      );
    });

    it('should handle different content types', async () => {
      mockedPrisma.site.findUnique.mockResolvedValue(mockSite);
      mockedUnifiedSearchService.unifiedSearch.mockResolvedValue({
        ...mockSearchResults,
        searchedTypes: ['post'],
      });

      const response = await request(app)
        .post('/api/embedding/search')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          ...searchRequest,
          content_type: 'post',
        })
        .expect(200);

      expect(response.body.searchedTypes).toEqual(['post']);
    });

    it('should apply minimum score filter', async () => {
      mockedPrisma.site.findUnique.mockResolvedValue(mockSite);
      mockedUnifiedSearchService.unifiedSearch.mockResolvedValue(mockSearchResults);

      await request(app)
        .post('/api/embedding/search')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          ...searchRequest,
          min_score: 0.7,
        })
        .expect(200);

      expect(mockedUnifiedSearchService.unifiedSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          min_score: 0.7,
        })
      );
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/embedding/search')
        .send(searchRequest)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 403 for unauthorized site access', async () => {
      const unauthorizedSite = {
        ...mockSite,
        user_id: 'other-user-id',
      };

      mockedPrisma.site.findUnique.mockResolvedValue(unauthorizedSite);

      const response = await request(app)
        .post('/api/embedding/search')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(searchRequest)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing query', async () => {
      const response = await request(app)
        .post('/api/embedding/search')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({ site_id: 'site-123' }) // Missing query
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle search service errors gracefully', async () => {
      mockedPrisma.site.findUnique.mockResolvedValue(mockSite);
      mockedUnifiedSearchService.unifiedSearch.mockResolvedValue({
        success: false,
        results: [],
        totalResults: 0,
        searchedTypes: [],
        query: 'test search query',
        site_id: 'site-123',
      });

      const response = await request(app)
        .post('/api/embedding/search')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(searchRequest)
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.results).toEqual([]);
    });
  });

  describe('GET /api/embedding/search/analyze', () => {
    it('should analyze search query successfully', async () => {
      const mockAnalysis = {
        suggested_content_type: 'product' as const,
        confidence: 0.8,
        reasoning: 'Query contains 2 product-related keywords',
      };

      mockedUnifiedSearchService.analyzeSearchQuery.mockReturnValue(mockAnalysis);

      const response = await request(app)
        .get('/api/embedding/search/analyze')
        .query({ query: 'buy laptop with best price' })
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toEqual({
        query: 'buy laptop with best price',
        analysis: mockAnalysis,
      });
    });

    it('should return 400 for missing query', async () => {
      const response = await request(app)
        .get('/api/embedding/search/analyze')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/embedding/search/analyze')
        .query({ query: 'test query' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/sites/:siteId/content/stats', () => {
    const mockContentStats = {
      site_id: 'site-123',
      posts: {
        chunk_count: 150,
        exists: true,
      },
      products: {
        product_count: 25,
        exists: true,
      },
    };

    it('should return content statistics for site', async () => {
      mockedPrisma.site.findUnique.mockResolvedValue(mockSite);
      mockedUnifiedSearchService.getSiteContentStats.mockResolvedValue(mockContentStats);

      const response = await request(app)
        .get('/api/sites/site-123/content/stats')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toEqual(mockContentStats);
      expect(mockedUnifiedSearchService.getSiteContentStats).toHaveBeenCalledWith('site-123');
    });

    it('should return 403 for unauthorized site access', async () => {
      const unauthorizedSite = {
        ...mockSite,
        user_id: 'other-user-id',
      };

      mockedPrisma.site.findUnique.mockResolvedValue(unauthorizedSite);

      const response = await request(app)
        .get('/api/sites/site-123/content/stats')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent site', async () => {
      mockedPrisma.site.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/sites/site-123/content/stats')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});