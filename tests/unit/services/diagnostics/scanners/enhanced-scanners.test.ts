import { LlmsTxtScanner } from '../../../../../src/services/diagnostics/scanners/llmsTxt.scanner';
import { RobotsScanner } from '../../../../../src/services/diagnostics/scanners/robots.scanner';
import { JsonLdScanner } from '../../../../../src/services/diagnostics/scanners/jsonLd.scanner';
import { SeoBasicScanner } from '../../../../../src/services/diagnostics/scanners/seoBasic.scanner';
import { ScannerContext } from '../../../../../src/services/diagnostics/scanners/base';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Enhanced Scanner Details', () => {
  describe('LlmsTxtScanner', () => {
    let scanner: LlmsTxtScanner;

    beforeEach(() => {
      scanner = new LlmsTxtScanner();
    });

    it('should provide enhanced details for missing llms.txt', async () => {
      const context: ScannerContext = {
        auditId: 'test-audit',
        siteUrl: 'https://example.com',
        pageUrl: 'https://example.com',
      };

      // Mock axios to return 404
      mockedAxios.get.mockResolvedValue({
        status: 404,
        data: '',
        headers: {}
      });

      const result = await scanner.scan(context);

      expect(result.status).toBe('fail');
      expect(result.details).toBeDefined();
      expect(result.details!.contentFound).toBe(false);
      expect(result.details!.validationIssues).toContain('File not found at /llms.txt');
      expect(result.details!.aiOptimizationOpportunities).toContain('Implement llms.txt file to provide AI agents with crawling instructions');
      expect(result.details!.specificData).toBeDefined();
      expect(result.details!.specificData!.checkedPaths).toContain('/llms.txt');
    });

    it('should provide enhanced details for valid llms.txt', async () => {
      const context: ScannerContext = {
        auditId: 'test-audit',
        siteUrl: 'https://example.com',
        pageUrl: 'https://example.com',
      };

      const validContent = `User-agent: *
Allow: /api/
Crawl-delay: 1`;

      // Mock axios to return valid content
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: validContent,
        headers: {}
      });

      const result = await scanner.scan(context);

      expect(result.status).toBe('pass');
      expect(result.details).toBeDefined();
      expect(result.details!.contentFound).toBe(true);
      expect(result.details!.contentPreview).toBeDefined();
      expect(result.details!.validationScore).toBe(1.0);
      expect(result.details!.aiReadinessFactors).toContain('Valid llms.txt file provides AI agent instructions');
      expect(result.details!.specificData).toBeDefined();
      expect(result.details!.specificData.hasUserAgent).toBeDefined();
    });
  });

  describe('RobotsScanner', () => {
    let scanner: RobotsScanner;

    beforeEach(() => {
      scanner = new RobotsScanner();
    });

    it('should provide enhanced details with AI readiness factors', async () => {
      const context: ScannerContext = {
        auditId: 'test-audit',
        siteUrl: 'https://example.com',
        pageUrl: 'https://example.com',
        pageHtml: '<html><head><meta name="robots" content="index,follow"></head></html>'
      };

      const robotsContent = `User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml

User-agent: GPTBot
Allow: /api/`;

      // Mock axios to return robots.txt content
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: robotsContent,
        headers: {}
      });

      const result = await scanner.scan(context);

      expect(result.details).toBeDefined();
      expect(result.details!.contentFound).toBe(true);
      expect(result.details!.aiReadinessFactors).toBeDefined();
      expect(result.details!.aiOptimizationOpportunities).toBeDefined();
      expect(result.details!.specificData).toBeDefined();
      expect(result.details!.specificData.hasAiDirectives).toBeDefined();
    });
  });

  describe('JsonLdScanner', () => {
    let scanner: JsonLdScanner;

    beforeEach(() => {
      scanner = new JsonLdScanner();
    });

    it('should provide enhanced details for missing JSON-LD', async () => {
      const context: ScannerContext = {
        auditId: 'test-audit',
        siteUrl: 'https://example.com',
        pageUrl: 'https://example.com',
        pageHtml: '<html><body>No structured data</body></html>'
      };

      const result = await scanner.scan(context);

      expect(result.status).toBe('fail');
      expect(result.details).toBeDefined();
      expect(result.details!.contentFound).toBe(false);
      expect(result.details!.validationIssues).toContain('No JSON-LD structured data detected');
      expect(result.details!.aiOptimizationOpportunities).toContain('Implement JSON-LD structured data for better content understanding');
    });

    it('should provide enhanced details for valid JSON-LD', async () => {
      const context: ScannerContext = {
        auditId: 'test-audit',
        siteUrl: 'https://example.com',
        pageUrl: 'https://example.com',
        pageHtml: `<html>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Example Corp",
            "url": "https://example.com"
          }
          </script>
        </html>`
      };

      const result = await scanner.scan(context);

      expect(result.details).toBeDefined();
      expect(result.details!.contentFound).toBe(true);
      expect(result.details!.validationScore).toBeGreaterThan(0);
      expect(result.details!.aiReadinessFactors).toBeDefined();
      expect(result.details!.aiOptimizationOpportunities).toBeDefined();
      expect(result.details!.specificData).toBeDefined();
    });
  });

  describe('SeoBasicScanner', () => {
    let scanner: SeoBasicScanner;

    beforeEach(() => {
      scanner = new SeoBasicScanner();
    });

    it('should provide enhanced details with AI readiness factors', async () => {
      const context: ScannerContext = {
        auditId: 'test-audit',
        siteUrl: 'https://example.com',
        pageUrl: 'https://example.com',
        pageHtml: `<html>
          <head>
            <title>Example Page Title</title>
            <meta name="description" content="This is an example page description">
            <meta property="og:title" content="Example Page">
          </head>
          <body>
            <h1>Main Heading</h1>
          </body>
        </html>`
      };

      const result = await scanner.scan(context);

      expect(result.details).toBeDefined();
      expect(result.details!.contentFound).toBe(true);
      expect(result.details!.validationScore).toBeGreaterThan(0);
      expect(result.details!.aiReadinessFactors).toBeDefined();
      expect(result.details!.aiOptimizationOpportunities).toBeDefined();
      expect(result.details!.specificData).toBeDefined();
      
      // Check that AI readiness factors mention the SEO elements
      const factors = result.details!.aiReadinessFactors || [];
      expect(factors.some((f: string) => f.includes('title'))).toBe(true);
    });
  });

  describe('Scanner Details Structure', () => {
    it('should have consistent IndicatorDetails structure across scanners', async () => {
      const context: ScannerContext = {
        auditId: 'test-audit',
        siteUrl: 'https://example.com',
        pageUrl: 'https://example.com',
        pageHtml: '<html><body>Test</body></html>'
      };

      // Mock fetch for network calls
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => ''
      });

      const scanners = [
        new LlmsTxtScanner(),
        new RobotsScanner(),
        new JsonLdScanner(),
        new SeoBasicScanner()
      ];

      for (const scanner of scanners) {
        const result = await scanner.scan(context);
        
        // Verify all scanners provide the enhanced details structure
        expect(result.details).toBeDefined();
        expect(typeof result.details!.contentFound).toBe('boolean');
        expect(Array.isArray(result.details!.aiOptimizationOpportunities)).toBe(true);
        expect(result.details!.specificData).toBeDefined();
        
        // AI-related fields should be present for standards category
        if (scanner.category === 'standards') {
          expect(Array.isArray(result.details!.aiReadinessFactors)).toBe(true);
        }
      }
    });
  });
});