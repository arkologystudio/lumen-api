import axios from 'axios';
import { embedText } from '../../../src/services/embedding';
import { ENV } from '../../../src/config/env';

// Mock axios
jest.mock('axios');
const mockedAxios = jest.mocked(axios);

// Mock environment variables
jest.mock('../../../src/config/env', () => ({
  ENV: {
    HUGGING_FACE_API_TOKEN: 'test-token',
    EMBEDDING_MODEL: 'intfloat/multilingual-e5-large',
  },
}));

describe('Embedding Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('embedText', () => {
    it('should successfully embed text and return vector array', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockedAxios.post.mockResolvedValueOnce({ data: mockEmbedding });

      const result = await embedText('test query');

      expect(result).toEqual(mockEmbedding);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api-inference.huggingface.co/models/intfloat%2Fmultilingual-e5-large',
        { inputs: 'test query' },
        {
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
    });

    it('should handle nested array response format', async () => {
      const mockEmbedding = [[0.1, 0.2, 0.3, 0.4, 0.5]];
      mockedAxios.post.mockResolvedValueOnce({ data: mockEmbedding });

      const result = await embedText('test query');

      expect(result).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    it('should throw error when HUGGING_FACE_API_TOKEN is missing', async () => {
      const originalToken = ENV.HUGGING_FACE_API_TOKEN;
      (ENV as any).HUGGING_FACE_API_TOKEN = undefined;

      await expect(embedText('test')).rejects.toThrow('HUGGING_FACE_API_TOKEN is not defined');

      (ENV as any).HUGGING_FACE_API_TOKEN = originalToken;
    });

    it('should throw error when EMBEDDING_MODEL is missing', async () => {
      const originalModel = ENV.EMBEDDING_MODEL;
      (ENV as any).EMBEDDING_MODEL = undefined;

      await expect(embedText('test')).rejects.toThrow('EMBEDDING_MODEL is not defined');

      (ENV as any).EMBEDDING_MODEL = originalModel;
    });

    it('should throw error for invalid response format', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: 'invalid' });

      await expect(embedText('test')).rejects.toThrow('Invalid response format: expected array');
    });

    it('should throw error for empty response array', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: [] });

      await expect(embedText('test')).rejects.toThrow('Empty embedding array received');
    });

    it('should throw error for empty embedding vector', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: [[]] });

      await expect(embedText('test')).rejects.toThrow('Empty embedding vector');
    });

    it('should throw error for non-numeric embedding values', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: [0.1, 'invalid', 0.3] });

      await expect(embedText('test')).rejects.toThrow('Invalid embedding format: expected numeric values');
    });

    it('should retry on 503 service unavailable error', async () => {
      const error503 = {
        isAxiosError: true,
        response: { status: 503 },
      };
      
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.post
        .mockRejectedValueOnce(error503)
        .mockResolvedValueOnce({ data: [0.1, 0.2, 0.3] });

      const result = await embedText('test');

      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 too many requests error', async () => {
      const error429 = {
        isAxiosError: true,
        response: { status: 429 },
      };
      
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.post
        .mockRejectedValueOnce(error429)
        .mockResolvedValueOnce({ data: [0.1, 0.2, 0.3] });

      const result = await embedText('test');

      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 400 bad request error', async () => {
      const error400 = {
        isAxiosError: true,
        response: { status: 400 },
      };
      
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.post.mockRejectedValueOnce(error400);

      await expect(embedText('test')).rejects.toEqual(error400);
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and throw error', async () => {
      const error503 = {
        isAxiosError: true,
        response: { status: 503 },
      };
      
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockedAxios.post.mockRejectedValue(error503);

      await expect(embedText('test')).rejects.toEqual(error503);
      expect(mockedAxios.post).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });
});