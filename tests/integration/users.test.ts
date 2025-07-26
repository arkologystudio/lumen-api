import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/config/database';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/supabaseStorage', () => ({
  initializeStorage: jest.fn().mockResolvedValue(undefined),
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
  });

  describe('GET /api/users/profile', () => {
    it('should return user profile successfully', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.id).toBe('user-123');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.name).toBe('Test User');
      expect(response.body.user).not.toHaveProperty('password_hash');
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

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.name).toBe('Updated Name');
      expect(response.body.user.email).toBe('updated@example.com');
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

  describe('DELETE /api/users/profile', () => {
    it('should deactivate user account successfully', async () => {
      mockedPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // Auth check
        .mockResolvedValueOnce(mockUser); // Existence check in deactivate function

      mockedPrisma.user.update.mockResolvedValue({
        ...mockUser,
        is_active: false,
      });

      const response = await request(app)
        .delete('/api/users/profile')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Account deactivated successfully');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .delete('/api/users/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/users/:userId/sites', () => {
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
        .get('/api/users/user-123/sites')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('sites');
      expect(response.body.sites).toHaveLength(2);
      expect(response.body.sites[0].name).toBe('Site 1');
      expect(response.body.sites[1].name).toBe('Site 2');
    });

    it('should return 403 when accessing other user sites', async () => {
      const response = await request(app)
        .get('/api/users/other-user-id/sites')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Access denied');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/users/user-123/sites')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return empty array when user has no sites', async () => {
      mockedPrisma.site.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users/user-123/sites')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('sites');
      expect(response.body.sites).toHaveLength(0);
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
      expect(response.body.activities[0].action).toBe('site_created');
      expect(response.body.activities[1].action).toBe('search_performed');
    });

    it('should support pagination', async () => {
      mockedPrisma.activityLog.findMany.mockResolvedValue(mockActivities.slice(0, 1));

      const response = await request(app)
        .get('/api/users/activities?limit=1&offset=0')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.activities).toHaveLength(1);
      expect(mockedPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
          skip: 0,
        })
      );
    });

    it('should filter activities by action type', async () => {
      const filteredActivities = [mockActivities[0]];
      mockedPrisma.activityLog.findMany.mockResolvedValue(filteredActivities);

      const response = await request(app)
        .get('/api/users/activities?action=site_created')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .expect(200);

      expect(response.body.activities).toHaveLength(1);
      expect(response.body.activities[0].action).toBe('site_created');
      expect(mockedPrisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: 'site_created',
          }),
        })
      );
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/users/activities')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/users/change-password', () => {
    const changePasswordData = {
      currentPassword: 'currentPass123',
      newPassword: 'NewStrongPass456',
    };

    it('should change password successfully', async () => {
      // Mock bcrypt for password verification and hashing
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('new-hashed-password');

      mockedPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // Auth check
        .mockResolvedValueOnce(mockUser); // Current user lookup

      mockedPrisma.user.update.mockResolvedValue({
        ...mockUser,
        password_hash: 'new-hashed-password',
      });

      const response = await request(app)
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(changePasswordData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Password changed successfully');
    });

    it('should return 400 for incorrect current password', async () => {
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      mockedPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // Auth check
        .mockResolvedValueOnce(mockUser); // Current user lookup

      const response = await request(app)
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(changePasswordData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Current password is incorrect');
    });

    it('should return 400 for weak new password', async () => {
      const response = await request(app)
        .post('/api/users/change-password')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          currentPassword: 'currentPass123',
          newPassword: 'weak',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Password must be at least 8 characters long');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/users/change-password')
        .send(changePasswordData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});