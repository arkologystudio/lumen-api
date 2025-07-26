import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { generateToken } from '../../../src/controllers/authController';
import { ENV } from '../../../src/config/env';

jest.mock('jsonwebtoken');
jest.mock('../../../src/config/env', () => ({
  ENV: {
    JWT_SECRET: 'test-secret',
    JWT_TTL: '3600',
  },
}));

const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('Auth Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateToken', () => {
    it('should generate and return a JWT token', async () => {
      const mockToken = 'generated-jwt-token';
      (mockedJwt.sign as jest.Mock).mockReturnValue(mockToken);

      await generateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockedJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          jti: expect.any(String),
        }),
        Buffer.from('test-secret'),
        {
          expiresIn: 3600,
        }
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        token: mockToken,
      });
    });

    it('should handle numeric JWT_TTL string', async () => {
      const mockToken = 'generated-jwt-token';
      (mockedJwt.sign as jest.Mock).mockReturnValue(mockToken);

      await generateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockedJwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Buffer),
        {
          expiresIn: 3600, // Should parse '3600' to number
        }
      );
    });

    it('should use default TTL for non-numeric strings', async () => {
      // Mock ENV.JWT_TTL to non-numeric value
      (ENV as any).JWT_TTL = 'invalid';
      
      const mockToken = 'generated-jwt-token';
      (mockedJwt.sign as jest.Mock).mockReturnValue(mockToken);

      await generateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockedJwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Buffer),
        {
          expiresIn: 3600, // Should default to 1 hour
        }
      );

      // Restore original value
      (ENV as any).JWT_TTL = '3600';
    });

    it('should generate unique JTI for each token', async () => {
      const mockToken1 = 'token-1';
      const mockToken2 = 'token-2';
      
      (mockedJwt.sign as jest.Mock)
        .mockReturnValueOnce(mockToken1)
        .mockReturnValueOnce(mockToken2);

      // First call
      await generateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const firstCall = (mockedJwt.sign as jest.Mock).mock.calls[0];
      const firstJti = firstCall[0].jti;

      // Second call
      await generateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const secondCall = (mockedJwt.sign as jest.Mock).mock.calls[1];
      const secondJti = secondCall[0].jti;

      expect(firstJti).not.toBe(secondJti);
      expect(typeof firstJti).toBe('string');
      expect(typeof secondJti).toBe('string');
    });

    it('should handle JWT signing errors', async () => {
      const error = new Error('JWT signing failed');
      (mockedJwt.sign as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await generateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(console.error).toHaveBeenCalledWith(error);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal server error',
      });
    });

    it('should convert JWT_SECRET to Buffer', async () => {
      const mockToken = 'generated-jwt-token';
      (mockedJwt.sign as jest.Mock).mockReturnValue(mockToken);

      await generateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockedJwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        Buffer.from('test-secret'),
        expect.any(Object)
      );
    });

    it('should handle undefined JWT_SECRET', async () => {
      // Mock undefined JWT_SECRET
      (ENV as any).JWT_SECRET = undefined;
      
      const mockToken = 'generated-jwt-token';
      (mockedJwt.sign as jest.Mock).mockReturnValue(mockToken);

      await generateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockedJwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        Buffer.from('undefined'), // Should convert undefined to string
        expect.any(Object)
      );

      // Restore original value
      (ENV as any).JWT_SECRET = 'test-secret';
    });
  });
});