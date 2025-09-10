import {
  fetchUrl,
  buildUrl,
  extractMetaTags,
  extractJsonLd,
  extractRobotsMeta,
  validateJsonSchema,
  parseRobotsTxt
} from '../../../../../src/services/diagnostics/scanners/base/scanner.utils';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Scanner Utils', () => {
  
  describe('fetchUrl', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should fetch URL successfully', async () => {
      const mockResponse = {
        status: 200,
        data: '<html><head><title>Test</title></head></html>',
        headers: { 'content-type': 'text/html' }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await fetchUrl('https://example.com');

      expect(result.found).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.content).toBe(mockResponse.data);
      expect(result.headers).toEqual(mockResponse.headers);
      expect(result.error).toBeUndefined();
    });

    it('should handle 404 errors', async () => {
      const mockResponse = {
        status: 404,
        data: 'Not Found',
        headers: { 'content-type': 'text/html' }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await fetchUrl('https://example.com/nonexistent');

      expect(result.found).toBe(false);
      expect(result.statusCode).toBe(404);
      expect(result.content).toBe('Not Found');
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      mockedAxios.get.mockRejectedValue(error);

      const result = await fetchUrl('https://example.com');

      expect(result.found).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle JSON responses', async () => {
      const jsonData = { message: 'success' };
      const mockResponse = {
        status: 200,
        data: jsonData,
        headers: { 'content-type': 'application/json' }
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await fetchUrl('https://api.example.com/data');

      expect(result.found).toBe(true);
      expect(result.content).toBe('{"message":"success"}');
    });

    it('should use custom timeout', async () => {
      const mockResponse = {
        status: 200,
        data: 'Success',
        headers: {}
      };
      
      mockedAxios.get.mockResolvedValue(mockResponse);

      await fetchUrl('https://example.com', 10000);

      expect(mockedAxios.get).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
        timeout: 10000
      }));
    });
  });

  describe('buildUrl', () => {
    it('should build URLs correctly', () => {
      expect(buildUrl('https://example.com', '/path')).toBe('https://example.com/path');
      expect(buildUrl('https://example.com/', '/path')).toBe('https://example.com/path');
      expect(buildUrl('https://example.com', 'path')).toBe('https://example.com/path');
      expect(buildUrl('https://example.com/base', '/path')).toBe('https://example.com/path');
      expect(buildUrl('https://example.com/base', 'path')).toBe('https://example.com/path');
    });

    it('should handle absolute URLs in path', () => {
      expect(buildUrl('https://example.com', 'https://other.com/path'))
        .toBe('https://other.com/path');
    });

    it('should throw error for invalid URLs', () => {
      expect(() => buildUrl('invalid-url', '/path')).toThrow('Invalid URL');
      expect(() => buildUrl('https://example.com', 'javascript:alert("hack")')).toThrow('Invalid URL');
    });
  });

  describe('extractMetaTags', () => {
    it('should extract basic meta tags', () => {
      const html = `
        <html>
          <head>
            <title>Test Page</title>
            <meta name="description" content="Test description">
            <meta name="keywords" content="test, example">
            <meta property="og:title" content="OG Title">
            <meta property="og:description" content="OG Description">
          </head>
        </html>
      `;

      const tags = extractMetaTags(html);

      expect(tags.title).toBe('Test Page');
      expect(tags.description).toBe('Test description');
      expect(tags.keywords).toBe('test, example');
      expect(tags['og:title']).toBe('OG Title');
      expect(tags['og:description']).toBe('OG Description');
    });

    it('should handle malformed HTML', () => {
      const html = `
        <html>
          <head>
            <title>Test Page</title>
            <meta name="description" content="Test description"
            <meta property="og:title" content="OG Title">
          </head>
        </html>
      `;

      const tags = extractMetaTags(html);

      expect(tags.title).toBe('Test Page');
      expect(tags['og:title']).toBe('OG Title');
    });

    it('should handle empty HTML', () => {
      const tags = extractMetaTags('');
      expect(Object.keys(tags)).toHaveLength(0);
    });

    it('should handle HTML without meta tags', () => {
      const html = '<html><body>No meta tags</body></html>';
      const tags = extractMetaTags(html);
      expect(Object.keys(tags)).toHaveLength(0);
    });
  });

  describe('extractJsonLd', () => {
    it('should extract valid JSON-LD', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "Example Org"
              }
            </script>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "url": "https://example.com"
              }
            </script>
          </head>
        </html>
      `;

      const jsonLd = extractJsonLd(html);

      expect(jsonLd).toHaveLength(2);
      expect(jsonLd[0]['@type']).toBe('Organization');
      expect(jsonLd[1]['@type']).toBe('WebSite');
    });

    it('should skip invalid JSON-LD', () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "Valid Org"
              }
            </script>
            <script type="application/ld+json">
              { invalid json }
            </script>
          </head>
        </html>
      `;

      const jsonLd = extractJsonLd(html);

      expect(jsonLd).toHaveLength(1);
      expect(jsonLd[0]['@type']).toBe('Organization');
    });

    it('should return empty array for no JSON-LD', () => {
      const html = '<html><head></head></html>';
      const jsonLd = extractJsonLd(html);
      expect(jsonLd).toEqual([]);
    });
  });

  describe('extractRobotsMeta', () => {
    it('should extract robots meta directives', () => {
      const html = `
        <html>
          <head>
            <meta name="robots" content="noindex, nofollow, noai">
            <meta name="robots-ai" content="noimageai">
          </head>
        </html>
      `;

      const robots = extractRobotsMeta(html);

      expect(robots.noindex).toBe(true);
      expect(robots.nofollow).toBe(true);
      expect(robots.noai).toBe(true);
      expect(robots.noimageai).toBe(true);
    });

    it('should handle missing robots meta', () => {
      const html = '<html><head></head></html>';
      const robots = extractRobotsMeta(html);

      expect(robots.noindex).toBe(false);
      expect(robots.nofollow).toBe(false);
      expect(robots.noai).toBe(false);
      expect(robots.noimageai).toBe(false);
    });

    it('should handle mixed case directives', () => {
      const html = `
        <html>
          <head>
            <meta name="robots" content="NOINDEX, NoFollow, NoAI">
          </head>
        </html>
      `;

      const robots = extractRobotsMeta(html);

      expect(robots.noindex).toBe(true);
      expect(robots.nofollow).toBe(true);
      expect(robots.noai).toBe(true);
    });
  });

  describe('validateJsonSchema', () => {
    it('should validate complete schema', () => {
      const data = {
        name: 'Test Name',
        description: 'Test Description',
        version: '1.0'
      };
      const requiredFields = ['name', 'description'];

      const result = validateJsonSchema(data, requiredFields);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it('should detect missing fields', () => {
      const data = {
        name: 'Test Name'
      };
      const requiredFields = ['name', 'description', 'version'];

      const result = validateJsonSchema(data, requiredFields);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(['description', 'version']);
    });

    it('should handle empty data', () => {
      const data = {};
      const requiredFields = ['name', 'description'];

      const result = validateJsonSchema(data, requiredFields);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(['name', 'description']);
    });

    it('should handle empty required fields', () => {
      const data = { name: 'Test' };
      const requiredFields: string[] = [];

      const result = validateJsonSchema(data, requiredFields);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toEqual([]);
    });
  });

  describe('parseRobotsTxt', () => {
    it('should parse basic robots.txt', () => {
      const content = `
        User-agent: *
        Disallow: /private/
        Allow: /public/
        Sitemap: https://example.com/sitemap.xml
        Crawl-delay: 10
      `;

      const result = parseRobotsTxt(content);

      expect(result.userAgents['*']).toBeDefined();
      expect(result.userAgents['*'].disallow).toContain('/private/');
      expect(result.userAgents['*'].allow).toContain('/public/');
      expect(result.sitemaps).toContain('https://example.com/sitemap.xml');
      expect(result.crawlDelay).toBe(10);
    });

    it('should handle multiple user agents', () => {
      const content = `
        User-agent: Googlebot
        Disallow: /admin/
        
        User-agent: Bingbot
        Disallow: /private/
        Allow: /public/
        
        User-agent: *
        Disallow: /
      `;

      const result = parseRobotsTxt(content);

      expect(result.userAgents['Googlebot']).toBeDefined();
      expect(result.userAgents['Googlebot'].disallow).toContain('/admin/');
      
      expect(result.userAgents['Bingbot']).toBeDefined();
      expect(result.userAgents['Bingbot'].disallow).toContain('/private/');
      expect(result.userAgents['Bingbot'].allow).toContain('/public/');
      
      expect(result.userAgents['*']).toBeDefined();
      expect(result.userAgents['*'].disallow).toContain('/');
    });

    it('should handle multiple sitemaps', () => {
      const content = `
        Sitemap: https://example.com/sitemap1.xml
        Sitemap: https://example.com/sitemap2.xml
        User-agent: *
        Disallow:
      `;

      const result = parseRobotsTxt(content);

      expect(result.sitemaps).toHaveLength(2);
      expect(result.sitemaps).toContain('https://example.com/sitemap1.xml');
      expect(result.sitemaps).toContain('https://example.com/sitemap2.xml');
    });

    it('should handle comments and empty lines', () => {
      const content = `
        # This is a comment
        User-agent: *
        
        # Another comment
        Disallow: /private/
        
        Sitemap: https://example.com/sitemap.xml
      `;

      const result = parseRobotsTxt(content);

      expect(result.userAgents['*']).toBeDefined();
      expect(result.userAgents['*'].disallow).toContain('/private/');
      expect(result.sitemaps).toContain('https://example.com/sitemap.xml');
    });

    it('should handle empty robots.txt', () => {
      const result = parseRobotsTxt('');

      expect(result.userAgents).toEqual({});
      expect(result.sitemaps).toEqual([]);
      expect(result.crawlDelay).toBeUndefined();
    });

    it('should handle malformed lines gracefully', () => {
      const content = `
        User-agent: *
        Disallow /private/
        InvalidDirective
        Disallow: /admin/
      `;

      const result = parseRobotsTxt(content);

      expect(result.userAgents['*']).toBeDefined();
      expect(result.userAgents['*'].disallow).toContain('/admin/');
      // Malformed lines should be ignored
    });
  });
});