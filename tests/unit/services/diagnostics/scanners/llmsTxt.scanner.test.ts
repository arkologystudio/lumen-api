import { LlmsTxtScanner } from '../../../../../src/services/diagnostics/scanners/llmsTxt.scanner';
import { ScannerContext } from '../../../../../src/services/diagnostics/scanners/base';
import { fetchUrl } from '../../../../../src/services/diagnostics/scanners/base/scanner.utils';

// Mock the fetchUrl utility
jest.mock('../../../../../src/services/diagnostics/scanners/base/scanner.utils', () => ({
  fetchUrl: jest.fn(),
  buildUrl: jest.fn((base, path) => `${base}${path}`)
}));

const mockedFetchUrl = fetchUrl as jest.MockedFunction<typeof fetchUrl>;

describe('LlmsTxtScanner', () => {
  let scanner: LlmsTxtScanner;
  let mockContext: ScannerContext;

  beforeEach(() => {
    scanner = new LlmsTxtScanner();
    mockContext = {
      auditId: 'audit-123',
      siteUrl: 'https://example.com'
    };
    jest.clearAllMocks();
  });

  describe('Scanner properties', () => {
    it('should have correct configuration', () => {
      expect(scanner.name).toBe('llms_txt');
      expect(scanner.category).toBe('standards');
      expect(scanner.description).toBe('Checks for the presence and validity of llms.txt file for AI agent instructions');
      expect(scanner.weight).toBe(2.0);
    });
  });

  describe('File not found scenarios', () => {
    it('should fail when llms.txt is not found', async () => {
      mockedFetchUrl.mockResolvedValue({
        found: false,
        statusCode: 404,
        error: 'Not found'
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('fail');
      expect(result.score).toBe(0.0);
      expect(result.message).toBe('No llms.txt file found');
      expect(result.found).toBe(false);
      expect(result.isValid).toBe(false);
      expect(result.checkedUrl).toBe('https://example.com/llms.txt');
      expect(result.recommendation).toContain('Create an llms.txt file');
    });

    it('should handle network errors', async () => {
      mockedFetchUrl.mockResolvedValue({
        found: false,
        error: 'Connection timeout'
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('fail');
      expect(result.details?.error).toBe('Connection timeout');
    });
  });

  describe('Valid llms.txt scenarios', () => {
    it('should pass for valid llms.txt with basic directives', async () => {
      const validContent = `User-agent: *
Disallow: /private/
Allow: /public/
Crawl-delay: 10`;

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: validContent
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('pass');
      expect(result.score).toBe(1.0);
      expect(result.message).toBe('Valid llms.txt file found');
      expect(result.found).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.details?.specificData?.parsedContent).toBeDefined();
      expect(result.details?.specificData?.parsedContent.userAgent).toBe('*');
      expect(result.details?.specificData?.directiveCount).toBeGreaterThan(0);
    });

    it('should handle complex llms.txt with multiple directives', async () => {
      const complexContent = `# AI Agent Instructions
User-agent: GPTBot
Disallow: /admin/
Allow: /api/public/

User-agent: Claude-Bot
Disallow: /private/
Crawl-delay: 5

# Custom directive
custom-directive: value`;

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: complexContent
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('pass');
      expect(result.score).toBe(1.0);
      expect(result.details?.specificData?.parsedContent.userAgent).toBe('Claude-Bot');
      expect(result.details?.specificData?.parsedContent.disallow).toContain('/admin/');
      expect(result.details?.specificData?.parsedContent['custom-directive']).toBe('value');
    });
  });

  describe('Invalid llms.txt scenarios', () => {
    it('should warn for empty llms.txt file', async () => {
      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: ''
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('warn');
      expect(result.score).toBe(0.5);
      expect(result.message).toBe('llms.txt file found but has issues');
      expect(result.details?.validationIssues).toContain('File is empty');
    });

    it('should warn for llms.txt missing User-agent', async () => {
      const invalidContent = `Disallow: /private/
Allow: /public/`;

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: invalidContent
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('warn');
      expect(result.score).toBe(0.5);
      expect(result.details?.validationIssues).toContain('Missing User-agent directive');
    });

    it('should warn for malformed directives', async () => {
      const malformedContent = `User-agent: *
Disallow /private/
InvalidLine
Crawl-delay: invalid-number`;

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: malformedContent
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('warn');
      expect(result.details?.validationIssues).toContain('Line 2: Invalid format, missing colon');
      expect(result.details?.validationIssues).toContain('Line 4: Invalid crawl-delay value');
    });

    it('should handle whitespace-only content', async () => {
      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: '   \n\n   \t   \n   '
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('warn');
      expect(result.details?.validationIssues).toContain('File is empty');
    });
  });

  describe('Edge cases', () => {
    it('should handle comments and empty lines', async () => {
      const contentWithComments = `# This is a comment
User-agent: *

# Another comment
Disallow: /private/

Allow: /public/`;

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: contentWithComments
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('pass');
      expect(result.details?.specificData?.directiveCount).toBe(3); // User-agent, Disallow, Allow
    });

    it('should handle mixed case directives', async () => {
      const mixedCaseContent = `USER-AGENT: *
DISALLOW: /private/
Allow: /public/
crawl-delay: 5`;

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: mixedCaseContent
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('pass');
      expect(result.details?.specificData?.parsedContent.userAgent).toBe('*');
      expect(result.details?.specificData?.parsedContent.disallow).toContain('/private/');
      expect(result.details?.specificData?.parsedContent.allow).toContain('/public/');
    });

    it('should handle special characters in values', async () => {
      const specialContent = `User-agent: MyBot/1.0 (+http://example.com/bot)
Disallow: /cgi-bin/
Allow: /~public/
Crawl-delay: 0.5`;

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: specialContent
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('pass');
      expect(result.details?.specificData?.parsedContent.userAgent).toBe('MyBot/1.0 (+http://example.com/bot)');
    });

    it('should handle very large files', async () => {
      const largeContent = Array(1000).fill('User-agent: *\nDisallow: /test/').join('\n');

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: largeContent
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('pass');
      expect(result.details?.specificData?.directiveCount).toBeGreaterThan(1000);
    });
  });

  describe('URL building', () => {
    it('should build correct URL for llms.txt', async () => {
      mockedFetchUrl.mockResolvedValue({
        found: false,
        statusCode: 404
      });

      await scanner.scan(mockContext);

      expect(mockedFetchUrl).toHaveBeenCalledWith('https://example.com/llms.txt');
    });

    it('should handle trailing slash in site URL', async () => {
      const contextWithTrailingSlash = {
        ...mockContext,
        siteUrl: 'https://example.com/'
      };

      mockedFetchUrl.mockResolvedValue({
        found: false,
        statusCode: 404
      });

      await scanner.scan(contextWithTrailingSlash);

      expect(mockedFetchUrl).toHaveBeenCalledWith('https://example.com//llms.txt');
    });
  });

  describe('Error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      // Mock fetchUrl to return an error result
      mockedFetchUrl.mockResolvedValue({
        found: false,
        error: 'Network error'
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('fail');
      expect(result.details?.error).toBe('Network error');
    });
  });
});