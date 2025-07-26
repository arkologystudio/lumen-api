import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/config/database';

// Mock the database
jest.mock('../../src/config/database');
const mockedPrisma = jest.mocked(prisma);

// Mock Supabase storage initialization
jest.mock('../../src/services/supabaseStorage', () => ({
  initializeStorage: jest.fn().mockResolvedValue(undefined),
}));

describe('Auth Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/token', () => {
    it('should generate a JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/token')
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);
    });

    it('should return different tokens on multiple requests', async () => {
      const response1 = await request(app)
        .post('/api/auth/token')
        .expect(200);

      const response2 = await request(app)
        .post('/api/auth/token')
        .expect(200);

      expect(response1.body.token).not.toBe(response2.body.token);
    });
  });

  describe('POST /api/auth/register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'StrongPass123',
      name: 'Test User',
    };

    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashed-password',
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
        subscription_tier: 'free',
        stripe_customer_id: null,
        current_period_end: null,
        trial_end: null,
      };

      mockedPrisma.user.findUnique.mockResolvedValue(null);
      mockedPrisma.user.create.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(201);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.name).toBe('Test User');
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegistrationData,
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid email format');
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegistrationData,
          password: 'weak',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Password must be at least 8 characters long');
    });

    it('should return 400 if user already exists', async () => {
      const existingUser = {
        id: 'existing-user',
        email: 'test@example.com',
        name: 'Existing User',
        password_hash: 'hash',
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true,
        subscription_tier: 'free',
        stripe_customer_id: null,
        current_period_end: null,
        trial_end: null,
      };

      mockedPrisma.user.findUnique.mockResolvedValue(existingUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('User with this email already exists');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          // Missing password and name
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user successfully with valid credentials', async () => {
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

      mockedPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Mock bcrypt.compare to return true
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user).not.toHaveProperty('password_hash');
    });

    it('should return 401 for invalid credentials', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid email or password');
    });

    it('should return 401 for inactive user', async () => {
      const inactiveUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        password_hash: '$2b$12$validHashHere',
        created_at: new Date(),
        updated_at: new Date(),
        is_active: false, // Inactive user
        subscription_tier: 'free',
        stripe_customer_id: null,
        current_period_end: null,
        trial_end: null,
      };

      mockedPrisma.user.findUnique.mockResolvedValue(inactiveUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid email or password');
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          // Missing password
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

});