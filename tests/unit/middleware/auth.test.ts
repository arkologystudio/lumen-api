import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateUser } from '../../../src/middleware/auth';
import { prisma } from '../../../src/config/database';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../../src/config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

const mockedJwt = jest.mocked(jwt);
const mockedPrisma = jest.mocked(prisma);

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request & { user?: any }>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password_hash: 'hash',
    created_at: new Date(),
    updated_at: new Date(),
    is_active: true,
    subscription_tier: 'free',
    stripe_customer_id: null,
    current_period_end: null,
    trial_end: null,
  };

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateUser', () => {
    it('should authenticate user with valid Bearer token', async () => {
      const mockPayload = {
        jti: 'token-id',
        user_id: 'user-123',
        email: 'test@example.com',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      (mockedJwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockedPrisma.user.findUnique.mockResolvedValue(mockUser);

      await authenticateUser(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        created_at: mockUser.created_at.toISOString(),
        updated_at: mockUser.updated_at.toISOString(),
        is_active: true,
        subscription_tier: 'free',
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should return 401 when no authorization header is provided', async () => {
      mockRequest.headers = {};

      await authenticateUser(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing bearer token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header does not start with Bearer', async () => {
      mockRequest.headers = {
        authorization: 'Basic some-token',
      };

      await authenticateUser(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing bearer token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when JWT verification fails', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      mockedJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticateUser(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not found', async () => {
      const mockPayload = {
        jti: 'token-id',
        user_id: 'non-existent-user',
        email: 'test@example.com',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      (mockedJwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      await authenticateUser(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user is inactive', async () => {
      const mockPayload = {
        jti: 'token-id',
        user_id: 'user-123',
        email: 'test@example.com',
      };

      const inactiveUser = {
        ...mockUser,
        is_active: false,
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      (mockedJwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockedPrisma.user.findUnique.mockResolvedValue(inactiveUser);

      await authenticateUser(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const mockPayload = {
        jti: 'token-id',
        user_id: 'user-123',
        email: 'test@example.com',
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token',
      };

      (mockedJwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockedPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await authenticateUser(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should extract token correctly from authorization header', async () => {
      const mockPayload = {
        jti: 'token-id',
        user_id: 'user-123',
        email: 'test@example.com',
      };

      mockRequest.headers = {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token.signature',
      };

      (mockedJwt.verify as jest.Mock).mockReturnValue(mockPayload);
      mockedPrisma.user.findUnique.mockResolvedValue(mockUser);

      await authenticateUser(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockedJwt.verify).toHaveBeenCalledWith(
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token.signature',
        expect.any(String)
      );
      expect(mockNext).toHaveBeenCalled();
    });
  });
});