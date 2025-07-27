import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  createUser,
  loginUser,
  getUserById,
  getUserByEmail,
  updateUser,
  deactivateUser,
  getAllUsers,
  verifyUserToken,
} from '../../../src/services/userService';
import { prisma } from '../../../src/config/database';
// Remove unused import

// Mock external dependencies
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('../../../src/config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock('../../../src/config/env', () => ({
  ENV: {
    JWT_SECRET: 'test-secret',
    JWT_TTL: '1h',
  },
}));

const mockedBcrypt = jest.mocked(bcrypt);
const mockedJwt = jest.mocked(jwt);
const mockedPrisma = jest.mocked(prisma);

describe('User Service', () => {
  const mockDate = new Date('2023-01-01T00:00:00Z');
  const mockPrismaUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password_hash: 'hashed-password',
    created_at: mockDate,
    updated_at: mockDate,
    is_active: true,
    subscription_tier: 'free',
    stripe_customer_id: null,
    current_period_end: null,
    trial_end: null,
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z',
    is_active: true,
    subscription_tier: 'free' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    const createUserData = {
      email: 'new@example.com',
      password: 'StrongPass123',
      name: 'New User',
    };

    it('should create a new user successfully', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockedPrisma.user.create.mockResolvedValue(mockPrismaUser);
      (mockedJwt.sign as jest.Mock).mockReturnValue('jwt-token');

      const result = await createUser(createUserData);

      expect(result.user).toEqual(mockUser);
      expect(result.token).toBe('jwt-token');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('StrongPass123', 12);
      expect(mockedPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          name: 'New User',
          password_hash: 'hashed-password',
          subscription_tier: 'free',
        },
      });
    });

    it('should throw error for invalid email format', async () => {
      await expect(
        createUser({ ...createUserData, email: 'invalid-email' })
      ).rejects.toThrow('Invalid email format');
    });

    it('should throw error for weak password', async () => {
      await expect(
        createUser({ ...createUserData, password: 'weak' })
      ).rejects.toThrow('Password must be at least 8 characters long');
    });

    it('should throw error for password without required characters', async () => {
      await expect(
        createUser({ ...createUserData, password: 'weakpassword' })
      ).rejects.toThrow('Password must contain at least one lowercase letter, one uppercase letter, and one number');
    });

    it('should throw error for empty name', async () => {
      await expect(
        createUser({ ...createUserData, name: '   ' })
      ).rejects.toThrow('Name is required');
    });

    it('should throw error if user already exists', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(mockPrismaUser);

      await expect(createUser(createUserData)).rejects.toThrow('User with this email already exists');
    });
  });

  describe('loginUser', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user successfully', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(mockPrismaUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockedJwt.sign as jest.Mock).mockReturnValue('jwt-token');

      const result = await loginUser(loginData);

      expect(result.user).toEqual(mockUser);
      expect(result.token).toBe('jwt-token');
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
    });

    it('should throw error for non-existent user', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await expect(loginUser(loginData)).rejects.toThrow('Invalid email or password');
    });

    it('should throw error for inactive user', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        ...mockPrismaUser,
        is_active: false,
      });

      await expect(loginUser(loginData)).rejects.toThrow('Invalid email or password');
    });

    it('should throw error for incorrect password', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(mockPrismaUser);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(loginUser(loginData)).rejects.toThrow('Invalid email or password');
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(mockPrismaUser);

      const result = await getUserById('user-123');

      expect(result).toEqual(mockUser);
      expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should return null when user not found', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      const result = await getUserById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user when found', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(mockPrismaUser);

      const result = await getUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should normalize email to lowercase', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(mockPrismaUser);

      await getUserByEmail('TEST@EXAMPLE.COM');

      expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when user not found', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      const result = await getUserByEmail('non-existent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    const updateData = {
      email: 'updated@example.com',
      name: 'Updated Name',
    };

    it('should update user successfully', async () => {
      mockedPrisma.user.findUnique
        .mockResolvedValueOnce(mockPrismaUser) // First call - check user exists
        .mockResolvedValueOnce(null); // Second call - check email not taken
      mockedPrisma.user.update.mockResolvedValue({
        ...mockPrismaUser,
        ...updateData,
      });

      const result = await updateUser('user-123', updateData);

      expect(result.email).toBe('updated@example.com');
      expect(result.name).toBe('Updated Name');
      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          email: 'updated@example.com',
          name: 'Updated Name',
        },
      });
    });

    it('should throw error if user not found', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await expect(updateUser('non-existent', updateData)).rejects.toThrow('User not found');
    });

    it('should throw error for invalid email format', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(mockPrismaUser);

      await expect(
        updateUser('user-123', { email: 'invalid-email' })
      ).rejects.toThrow('Invalid email format');
    });

    it('should throw error if email already in use', async () => {
      mockedPrisma.user.findUnique
        .mockResolvedValueOnce(mockPrismaUser) // User exists
        .mockResolvedValueOnce({ ...mockPrismaUser, id: 'other-user' }); // Email taken

      await expect(
        updateUser('user-123', { email: 'taken@example.com' })
      ).rejects.toThrow('Email already in use');
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user successfully', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(mockPrismaUser);
      mockedPrisma.user.update.mockResolvedValue({
        ...mockPrismaUser,
        is_active: false,
      });

      await deactivateUser('user-123');

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { is_active: false },
      });
    });

    it('should throw error if user not found', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await expect(deactivateUser('non-existent')).rejects.toThrow('User not found');
    });
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      const mockUsers = [mockPrismaUser, { ...mockPrismaUser, id: 'user-456' }];
      mockedPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await getAllUsers();

      expect(result).toHaveLength(2);
      expect(mockedPrisma.user.findMany).toHaveBeenCalledWith({
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('verifyUserToken', () => {
    const mockPayload = {
      jti: 'token-id',
      user_id: 'user-123',
      email: 'test@example.com',
    };

    it('should verify token and return user', async () => {
      (mockedJwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockedPrisma.user.findUnique.mockResolvedValue(mockPrismaUser);

      const result = await verifyUserToken('valid-token');

      expect(result).toEqual(mockUser);
      expect(mockedJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    });

    it('should throw error for invalid token', async () => {
      mockedJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(verifyUserToken('invalid-token')).rejects.toThrow('Invalid or expired token');
    });

    it('should throw error for inactive user', async () => {
      (mockedJwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockedPrisma.user.findUnique.mockResolvedValue({
        ...mockPrismaUser,
        is_active: false,
      });

      await expect(verifyUserToken('valid-token')).rejects.toThrow('Invalid or expired token');
    });

    it('should throw error if user not found', async () => {
      (mockedJwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await expect(verifyUserToken('valid-token')).rejects.toThrow('Invalid or expired token');
    });
  });
});