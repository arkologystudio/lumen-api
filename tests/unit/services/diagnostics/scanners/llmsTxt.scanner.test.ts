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
    it('should pass for valid llms.txt with basic structure', async () => {
      const validContent = `# My Project

> This is a brief summary of my project and what it offers.

## Documentation
- [Getting Started](/docs/start): Introduction to the project
- [API Reference](/docs/api): Complete API documentation

## Optional
- [Examples](/examples): Code examples and tutorials`;

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
      expect(result.details?.specificData?.parsedContent.title).toBe('My Project');
      expect(result.details?.specificData?.sectionCount).toBeGreaterThan(0);
    });

    it('should handle complex llms.txt with multiple sections', async () => {
      const complexContent = `# Advanced Documentation Platform

> Comprehensive documentation and API reference for developers building with our platform.

## Core Documentation
- [Quick Start Guide](/docs/quickstart): Get up and running in 5 minutes
- [API Reference](/docs/api): Complete REST API documentation
- [SDK Documentation](/docs/sdk): Language-specific SDKs

## Examples & Tutorials
- [Basic Integration](/examples/basic): Simple implementation examples
- [Advanced Features](/examples/advanced): Complex use cases and patterns

## Support Resources
- [FAQ](/support/faq): Frequently asked questions
- [Community Forum](/community): Developer community discussions`;

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: complexContent
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('pass');
      expect(result.score).toBe(1.0);
      expect(result.details?.specificData?.parsedContent.title).toBe('Advanced Documentation Platform');
      expect(result.details?.specificData?.sectionCount).toBe(3);
      expect(result.details?.specificData?.linkCount).toBeGreaterThan(5);
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

    it('should warn for llms.txt missing title', async () => {
      const invalidContent = `> This is just a summary without a title

## Documentation
- [Getting Started](/docs/start): Introduction`;

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: invalidContent
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('warn');
      expect(result.score).toBe(0.5);
      expect(result.details?.validationIssues).toContain('Missing required H1 title (should start with "# ")');
    });

    it('should warn for malformed markdown links', async () => {
      const malformedContent = `# My Project

> Project summary

## Documentation
- [Getting Started(/docs/start): Missing closing bracket
- [API Reference](/docs/api): Valid link
- Invalid link format`;

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: malformedContent
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('warn');
      expect(result.details?.validationIssues).toContain('Line 6: Invalid markdown link format');
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
    it('should handle markdown comments and empty lines', async () => {
      const contentWithComments = `# My Documentation Site

> This is a comprehensive documentation platform for developers.

## Core Documentation

- [Quick Start](/docs/quick): Get started quickly  
- [API Reference](/docs/api): Complete API docs

## Optional Resources

- [Examples](/examples): Code examples`;

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: contentWithComments
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('pass');
      expect(result.details?.specificData?.sectionCount).toBe(2); // Core Documentation, Optional Resources
    });

    it('should handle title only (minimal valid structure)', async () => {
      const minimalContent = `# My Simple Project`;

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: minimalContent
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('warn'); // Missing summary is a warning, not a failure
      expect(result.details?.specificData?.parsedContent.title).toBe('My Simple Project');
            expect(result.details?.validationIssues).toContain('Consider adding a blockquote summary (starting with "> ") to provide context');
    });

    it('should handle special characters in URLs and descriptions', async () => {
      const specialContent = `# MyBot Documentation

> API documentation for MyBot/1.0 (+http://example.com/bot)

## API Endpoints
- [Public API](/api/v1/public~data): Access public data endpoints
- [CGI Scripts](/cgi-bin/): Legacy CGI interface
- [User Content](/~users/): User-generated content`;

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: specialContent
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('pass');
      expect(result.details?.specificData?.parsedContent.title).toBe('MyBot Documentation');
      expect(result.details?.specificData?.linkCount).toBe(3);
    });

    it('should handle very large files with many sections', async () => {
      // Generate a large llms.txt file with many sections
      const sections = Array(50).fill(0).map((_, i) => 
        `## Section ${i + 1}\n- [Link ${i + 1}](/link${i + 1}): Description ${i + 1}`
      ).join('\n\n');
      
      const largeContent = `# Large Documentation Site\n\n> This site has extensive documentation.\n\n${sections}`;

      mockedFetchUrl.mockResolvedValue({
        found: true,
        statusCode: 200,
        content: largeContent
      });

      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('pass');
      expect(result.details?.specificData?.sectionCount).toBe(50);
      expect(result.details?.specificData?.linkCount).toBe(50);
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