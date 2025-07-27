import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/config/database';

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    site: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    activityLog: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
  },
}));
jest.mock('../../src/services/supabaseStorage', () => ({
  initializeStorage: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/activityLogService', () => ({
  logActivityWithRequest: jest.fn().mockResolvedValue({
    id: 'activity-1',
    user_id: 'user-123',
    activity_type: 'test',
    title: 'Test Activity',
    description: 'Test activity',
    site_id: null,
    target_id: null,
    target_type: null,
    metadata: {},
    ip_address: '127.0.0.1',
    user_agent: 'test-agent',
    created_at: new Date().toISOString(),
    user: {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      created_at: new Date('2023-01-01').toISOString(),
      updated_at: new Date('2023-01-01').toISOString(),
      is_active: true,
      subscription_tier: 'free',
    },
    site: null,
  }),
  getUserActivities: jest.fn().mockResolvedValue({
    activities: [
      {
        id: 'activity-1',
        user_id: 'user-123',
        activity_type: 'site_created',
        title: 'Site Created',
        description: 'Created a new site',
        site_id: 'site-123',
        target_id: 'site-123',
        target_type: 'site',
        metadata: { site_name: 'Test Site' },
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        created_at: new Date().toISOString(),
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
          created_at: new Date('2023-01-01').toISOString(),
          updated_at: new Date('2023-01-01').toISOString(),
          is_active: true,
          subscription_tier: 'free',
        },
        site: {
          id: 'site-123',
          name: 'Test Site',
          url: 'https://example.com',
        },
      },
      {
        id: 'activity-2',
        user_id: 'user-123',
        activity_type: 'search_performed',
        title: 'Search Performed',
        description: 'Performed a search query',
        site_id: null,
        target_id: null,
        target_type: null,
        metadata: { query: 'test query' },
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        created_at: new Date().toISOString(),
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
          created_at: new Date('2023-01-01').toISOString(),
          updated_at: new Date('2023-01-01').toISOString(),
          is_active: true,
          subscription_tier: 'free',
        },
        site: null,
      },
    ],
    totalCount: 2,
    page: 1,
    totalPages: 1,
  }),
  ACTIVITY_TYPES: {
    PROFILE_UPDATED: 'profile_updated',
    SITE_CREATED: 'site_created',
    SEARCH_PERFORMED: 'search_performed',
  },
}));

const mockedPrisma = jest.mocked(prisma);

describe('Users Integration Tests', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password_hash: '$2b$12$validHashHere',
    created_at: new Date('2023-01-01'),
    updated_at: new Date('2023-01-01'),
    is_active: true,
    subscription_tier: 'free',
    stripe_customer_id: null,
    current_period_end: null,
    trial_end: null,
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

    // Mock user lookup for authentication
    mockedPrisma.user.findUnique.mockResolvedValue(mockUser);
    
    // Mock activity log methods
    mockedPrisma.activityLog.count.mockResolvedValue(0);
    mockedPrisma.activityLog.findMany.mockResolvedValue([]);
    mockedPrisma.activityLog.create.mockResolvedValue({
      id: 'activity-1',
      user_id: 'user-123',
      activity_type: 'test',
      title: 'Test Activity',
      description: 'Test activity',
      site_id: null,
      target_id: null,
      target_type: null,
      metadata: {},
      ip_address: '127.0.0.1',
      user_agent: 'test-agent',
      created_at: new Date(),
    });
  });

  describe('GET /api/users/profile', () => {
    it('should return user profile successfully', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data.id).toBe('user-123');
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.name).toBe('Test User');
      expect(response.body.data).not.toHaveProperty('password_hash');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/users/profile', () => {
    const updateData = {
      name: 'Updated Name',
      email: 'updated@example.com',
    };

    it('should update user profile successfully', async () => {
      const updatedUser = {
        ...mockUser,
        name: 'Updated Name',
        email: 'updated@example.com',
        updated_at: new Date(),
      };

      // Mock the user existence check and email availability check
      mockedPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // Auth check
        .mockResolvedValueOnce(mockUser) // Existence check in update function
        .mockResolvedValueOnce(null); // Email availability check

      mockedPrisma.user.update.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.email).toBe('updated@example.com');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          ...updateData,
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid email format');
    });

    it('should return 400 if email is already taken', async () => {
      const existingUser = {
        ...mockUser,
        id: 'other-user',
        email: 'updated@example.com',
      };

      mockedPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // Auth check
        .mockResolvedValueOnce(mockUser) // Existence check
        .mockResolvedValueOnce(existingUser); // Email taken check

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Email already in use');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .send(updateData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });


  describe('GET /api/users/sites', () => {
    const mockSites = [
      {
        id: 'site-1',
        user_id: 'user-123',
        name: 'Site 1',
        url: 'https://site1.com',
        description: null,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
        embedding_status: 'completed',
        last_embedding_at: new Date(),
        post_count: 10,
        chunk_count: 50,
      },
      {
        id: 'site-2',
        user_id: 'user-123',
        name: 'Site 2',
        url: 'https://site2.com',
        description: null,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
        embedding_status: 'completed',
        last_embedding_at: new Date(),
        post_count: 5,
        chunk_count: 25,
      },
    ];

    it('should return user sites successfully', async () => {
      mockedPrisma.site.findMany.mockResolvedValue(mockSites);

      const response = await request(app)
        .get('/api/users/sites')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Site 1');
      expect(response.body.data[1].name).toBe('Site 2');
    });


    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/users/sites')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return empty array when user has no sites', async () => {
      mockedPrisma.site.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users/sites')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/users/activities', () => {
    const mockActivities = [
      {
        id: 'activity-1',
        user_id: 'user-123',
        activity_type: 'site_created',
        title: 'Site Created',
        description: 'Created a new site',
        site_id: 'site-123',
        target_id: 'site-123',
        target_type: 'site',
        metadata: { site_name: 'Test Site' },
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        created_at: new Date(),
      },
      {
        id: 'activity-2',
        user_id: 'user-123',
        activity_type: 'search_performed',
        title: 'Search Performed',
        description: 'Performed a search query',
        site_id: null,
        target_id: null,
        target_type: null,
        metadata: { query: 'test query' },
        ip_address: '127.0.0.1',
        user_agent: 'test-agent',
        created_at: new Date(),
      },
    ];

    it('should return user activities successfully', async () => {
      mockedPrisma.activityLog.findMany.mockResolvedValue(mockActivities);

      const response = await request(app)
        .get('/api/users/activities')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('activities');
      expect(response.body.activities).toHaveLength(2);
      expect(response.body.activities[0].activity_type).toBe('site_created');
      expect(response.body.activities[1].activity_type).toBe('search_performed');
    });

    it('should support pagination', async () => {
      mockedPrisma.activityLog.findMany.mockResolvedValue(mockActivities.slice(0, 1));
      mockedPrisma.activityLog.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/users/activities?limit=1&offset=0')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.activities).toHaveLength(2);
    });

    it('should filter activities by action type', async () => {
      const filteredActivities = [mockActivities[0]];
      mockedPrisma.activityLog.findMany.mockResolvedValue(filteredActivities);
      mockedPrisma.activityLog.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/users/activities?activity_types=site_created')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.activities).toHaveLength(2);
      expect(response.body.activities[0].activity_type).toBe('site_created');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/users/activities')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

});