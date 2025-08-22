import { HttpCrawler } from '../../../../../src/services/diagnostics/crawler/httpCrawler';
import { CrawlOptions } from '../../../../../src/services/diagnostics/crawler/crawler.interface';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Setup axios.get mock
mockedAxios.get = jest.fn();

// Mock JSDOM
const mockDocument = {
  querySelector: jest.fn(),
  body: {
    textContent: 'Test page content with multiple words for counting'
  }
};

jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation(() => ({
    window: {
      document: mockDocument
    }
  }))
}));

describe('HttpCrawler', () => {
  let crawler: HttpCrawler;

  beforeEach(() => {
    crawler = new HttpCrawler();
    jest.clearAllMocks();
    
    // Set up default JSDOM mock behavior
    mockDocument.querySelector.mockImplementation((selector) => {
      if (selector === 'title') {
        return { textContent: 'Test Page Title' };
      }
      if (selector === 'meta[name="description"]') {
        return { getAttribute: () => 'Test meta description' };
      }
      return null;
    });
  });

  afterEach(async () => {
    await crawler.close();
  });

  describe('Constructor and configuration', () => {
    it('should initialize with default configuration', () => {
      const defaultCrawler = new HttpCrawler();
      expect(defaultCrawler).toBeInstanceOf(HttpCrawler);
    });

    it('should accept custom configuration', () => {
      const customCrawler = new HttpCrawler({
        maxConcurrent: 10,
        defaultTimeout: 60000,
        defaultUserAgent: 'Custom Bot'
      });
      expect(customCrawler).toBeInstanceOf(HttpCrawler);
    });
  });

  describe('Single URL crawling', () => {
    it('should crawl a URL successfully', async () => {
      const mockResponse = {
        status: 200,
        data: '<html><head><title>Test Page</title><meta name="description" content="Test description"></head><body>Content</body></html>',
        headers: { 'content-type': 'text/html' },
        request: { responseURL: 'https://example.com' },
        config: { url: 'https://example.com' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await crawler.crawl('https://example.com');

      expect(result.url).toBe('https://example.com');
      expect(result.statusCode).toBe(200);
      expect(result.html).toBe(mockResponse.data);
      expect(result.title).toBe('Test Page Title');
      expect(result.metaDescription).toBe('Test meta description');
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.loadTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should handle 404 responses', async () => {
      const mockResponse = {
        status: 404,
        data: 'Not Found',
        headers: { 'content-type': 'text/html' },
        request: { responseURL: 'https://example.com/404' },
        config: { url: 'https://example.com/404' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await crawler.crawl('https://example.com/404');

      expect(result.statusCode).toBe(404);
      expect(result.html).toBe('Not Found');
      expect(result.error).toBeUndefined();
    });

    it('should handle network errors', async () => {
      const error = new Error('Network timeout');
      (mockedAxios.get as jest.Mock).mockRejectedValue(error);

      const result = await crawler.crawl('https://example.com');

      expect(result.statusCode).toBe(0);
      expect(result.html).toBe('');
      expect(result.error).toBe('Network timeout');
    });

    it('should handle axios errors with response', async () => {
      const error = {
        response: {
          status: 500,
          headers: { 'content-type': 'text/html' }
        },
        message: 'Server error'
      };
      (mockedAxios.get as jest.Mock).mockRejectedValue(error);

      const result = await crawler.crawl('https://example.com');

      expect(result.statusCode).toBe(500);
      expect(result.error).toBe('Server error');
    });
  });

  describe('Crawl options', () => {
    it('should use custom timeout', async () => {
      const mockResponse = {
        status: 200,
        data: '<html></html>',
        headers: {},
        request: { responseURL: 'https://example.com' },
        config: { url: 'https://example.com' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      const options: CrawlOptions = {
        timeout: 10000
      };

      await crawler.crawl('https://example.com', options);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          timeout: 10000
        })
      );
    });

    it('should use custom user agent', async () => {
      const mockResponse = {
        status: 200,
        data: '<html></html>',
        headers: {},
        request: { responseURL: 'https://example.com' },
        config: { url: 'https://example.com' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      const options: CrawlOptions = {
        userAgent: 'Custom Test Bot/1.0'
      };

      await crawler.crawl('https://example.com', options);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'Custom Test Bot/1.0'
          })
        })
      );
    });

    it('should include default headers', async () => {
      const mockResponse = {
        status: 200,
        data: '<html></html>',
        headers: {},
        request: { responseURL: 'https://example.com' },
        config: { url: 'https://example.com' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      await crawler.crawl('https://example.com');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'DNT': '1'
          })
        })
      );
    });
  });

  describe('Multiple URL crawling', () => {
    it('should crawl multiple URLs', async () => {
      const mockResponse1 = {
        status: 200,
        data: '<html><title>Page 1</title></html>',
        headers: {},
        request: { responseURL: 'https://example.com/page1' },
        config: { url: 'https://example.com/page1' }
      };

      const mockResponse2 = {
        status: 200,
        data: '<html><title>Page 2</title></html>',
        headers: {},
        request: { responseURL: 'https://example.com/page2' },
        config: { url: 'https://example.com/page2' }
      };

      (mockedAxios.get as jest.Mock)
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const urls = ['https://example.com/page1', 'https://example.com/page2'];
      const results = await crawler.crawlMultiple(urls);

      expect(results).toHaveLength(2);
      expect(results[0].url).toBe('https://example.com/page1');
      expect(results[1].url).toBe('https://example.com/page2');
    });

    it('should handle mixed success and failure', async () => {
      const mockResponse = {
        status: 200,
        data: '<html><title>Success</title></html>',
        headers: {},
        request: { responseURL: 'https://example.com/success' },
        config: { url: 'https://example.com/success' }
      };

      (mockedAxios.get as jest.Mock)
        .mockResolvedValueOnce(mockResponse)
        .mockRejectedValueOnce(new Error('Failed'));

      const urls = ['https://example.com/success', 'https://example.com/fail'];
      const results = await crawler.crawlMultiple(urls);

      expect(results).toHaveLength(2);
      expect(results[0].statusCode).toBe(200);
      expect(results[1].statusCode).toBe(0);
      expect(results[1].error).toBe('Failed');
    });

    it('should respect concurrency limits', async () => {
      const customCrawler = new HttpCrawler({ maxConcurrent: 2 });
      
      // Mock 5 requests
      const mockResponse = {
        status: 200,
        data: '<html></html>',
        headers: {},
        request: { responseURL: 'https://example.com' },
        config: { url: 'https://example.com' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      const urls = Array(5).fill(0).map((_, i) => `https://example.com/page${i}`);
      const results = await customCrawler.crawlMultiple(urls);

      expect(results).toHaveLength(5);
      await customCrawler.close();
    });
  });

  describe('Content extraction', () => {
    it('should extract title correctly', async () => {
      const mockResponse = {
        status: 200,
        data: '<html><head><title>Extracted Title</title></head></html>',
        headers: {},
        request: { responseURL: 'https://example.com' },
        config: { url: 'https://example.com' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await crawler.crawl('https://example.com');

      expect(result.title).toBe('Test Page Title'); // From mocked JSDOM
    });

    it('should extract meta description correctly', async () => {
      const mockResponse = {
        status: 200,
        data: '<html><head><meta name="description" content="Page description"></head></html>',
        headers: {},
        request: { responseURL: 'https://example.com' },
        config: { url: 'https://example.com' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await crawler.crawl('https://example.com');

      expect(result.metaDescription).toBe('Test meta description'); // From mocked JSDOM
    });

    it('should calculate word count', async () => {
      const mockResponse = {
        status: 200,
        data: '<html><body>This is a test page with some content</body></html>',
        headers: {},
        request: { responseURL: 'https://example.com' },
        config: { url: 'https://example.com' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await crawler.crawl('https://example.com');

      expect(result.wordCount).toBeGreaterThan(0);
    });

    it('should handle pages without title or description', async () => {
      // Override mock to return null for selectors
      mockDocument.querySelector.mockReturnValue(null);

      const mockResponse = {
        status: 200,
        data: '<html><body>No title or description</body></html>',
        headers: {},
        request: { responseURL: 'https://example.com' },
        config: { url: 'https://example.com' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await crawler.crawl('https://example.com');

      expect(result.title).toBeUndefined();
      expect(result.metaDescription).toBeUndefined();
    });
  });

  describe('Redirect handling', () => {
    it('should track final URL after redirects', async () => {
      const mockResponse = {
        status: 200,
        data: '<html></html>',
        headers: {},
        request: { responseURL: 'https://example.com/final' },
        config: { url: 'https://example.com/redirect' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await crawler.crawl('https://example.com/redirect');

      expect(result.finalUrl).toBe('https://example.com/final');
      expect(result.redirectChain).toContain('https://example.com/redirect');
      expect(result.redirectChain).toContain('https://example.com/final');
    });

    it('should handle no redirects', async () => {
      const mockResponse = {
        status: 200,
        data: '<html></html>',
        headers: {},
        request: { responseURL: 'https://example.com' },
        config: { url: 'https://example.com' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await crawler.crawl('https://example.com');

      expect(result.finalUrl).toBe('https://example.com');
      expect(result.redirectChain).toEqual([]);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty HTML content', async () => {
      const mockResponse = {
        status: 200,
        data: '',
        headers: {},
        request: { responseURL: 'https://example.com' },
        config: { url: 'https://example.com' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await crawler.crawl('https://example.com');

      expect(result.html).toBe('');
      expect(result.statusCode).toBe(200);
    });

    it('should handle non-HTML content', async () => {
      const mockResponse = {
        status: 200,
        data: { message: 'JSON response' },
        headers: { 'content-type': 'application/json' },
        request: { responseURL: 'https://api.example.com' },
        config: { url: 'https://api.example.com' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await crawler.crawl('https://api.example.com');

      expect(result.html).toBe('{"message":"JSON response"}');
    });

    it('should handle very large content', async () => {
      const largeContent = 'x'.repeat(10000);
      const mockResponse = {
        status: 200,
        data: `<html><body>${largeContent}</body></html>`,
        headers: {},
        request: { responseURL: 'https://example.com' },
        config: { url: 'https://example.com' }
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await crawler.crawl('https://example.com');

      expect(result.html.length).toBeGreaterThan(10000);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Close method', () => {
    it('should close without errors', async () => {
      await expect(crawler.close()).resolves.toBeUndefined();
    });
  });
});