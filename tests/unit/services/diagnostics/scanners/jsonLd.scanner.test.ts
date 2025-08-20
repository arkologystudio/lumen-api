import { JsonLdScanner } from '../../../../../src/services/diagnostics/scanners/jsonLd.scanner';
import { ScannerContext } from '../../../../../src/services/diagnostics/scanners/base';

describe('JsonLdScanner', () => {
  let scanner: JsonLdScanner;
  let mockContext: ScannerContext;

  beforeEach(() => {
    scanner = new JsonLdScanner();
    mockContext = {
      auditId: 'audit-123',
      siteUrl: 'https://example.com'
    };
  });

  describe('Scanner properties', () => {
    it('should have correct configuration', () => {
      expect(scanner.name).toBe('json_ld');
      expect(scanner.category).toBe('structured_data');
      expect(scanner.description).toBe('Analyzes JSON-LD structured data for search engine and AI understanding');
      expect(scanner.weight).toBe(2.0);
    });
  });

  describe('No HTML scenarios', () => {
    it('should return not_applicable when no HTML is provided', async () => {
      const result = await scanner.scan(mockContext);

      expect(result.status).toBe('not_applicable');
      expect(result.message).toBe('No HTML content available for JSON-LD analysis');
    });
  });

  describe('No JSON-LD scenarios', () => {
    it('should fail when no JSON-LD is found', async () => {
      const htmlWithoutJsonLd = `
        <html>
          <head><title>Test Page</title></head>
          <body><p>No structured data here</p></body>
        </html>
      `;

      const contextWithHtml = { ...mockContext, pageHtml: htmlWithoutJsonLd };
      const result = await scanner.scan(contextWithHtml);

      expect(result.status).toBe('fail');
      expect(result.score).toBe(0.0);
      expect(result.message).toBe('No JSON-LD structured data found');
      expect(result.recommendation).toContain('Add JSON-LD structured data');
    });
  });

  describe('Valid JSON-LD scenarios', () => {
    it('should pass for basic Organization schema', async () => {
      const htmlWithOrganization = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Example Company",
              "url": "https://example.com",
              "description": "We do great things"
            }
            </script>
          </head>
        </html>
      `;

      const contextWithHtml = { ...mockContext, pageHtml: htmlWithOrganization };
      const result = await scanner.scan(contextWithHtml);

      expect(result.status).toBe('pass');
      expect(result.score).toBeGreaterThanOrEqual(0.8);
      expect(result.details?.specificData?.found).toBe(true);
      expect(result.details?.specificData?.count).toBe(1);
      expect(result.details?.specificData?.hasOrganization).toBe(true);
      expect(result.details?.specificData?.types).toContain('Organization');
    });

    it('should pass for WebSite schema', async () => {
      const htmlWithWebsite = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Example Site",
              "url": "https://example.com"
            }
            </script>
          </head>
        </html>
      `;

      const contextWithHtml = { ...mockContext, pageHtml: htmlWithWebsite };
      const result = await scanner.scan(contextWithHtml);

      expect(result.status).toBe('pass');
      expect(result.details?.specificData?.hasWebSite).toBe(true);
      expect(result.details?.specificData?.types).toContain('WebSite');
    });

    it('should handle multiple JSON-LD scripts', async () => {
      const htmlWithMultiple = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Example Company"
            }
            </script>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "url": "https://example.com"
            }
            </script>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Article",
              "headline": "Great Article",
              "author": "John Doe"
            }
            </script>
          </head>
        </html>
      `;

      const contextWithHtml = { ...mockContext, pageHtml: htmlWithMultiple };
      const result = await scanner.scan(contextWithHtml);

      expect(result.status).toBe('pass');
      expect(result.score).toBe(1.0);
      expect(result.details?.specificData?.count).toBe(3);
      expect(result.details?.specificData?.hasOrganization).toBe(true);
      expect(result.details?.specificData?.hasWebSite).toBe(true);
      expect(result.details?.specificData?.hasArticle).toBe(true);
    });

    it('should recognize AI-relevant types', async () => {
      const htmlWithAiTypes = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": []
            }
            </script>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "HowTo",
              "name": "How to do something"
            }
            </script>
          </head>
        </html>
      `;

      const contextWithHtml = { ...mockContext, pageHtml: htmlWithAiTypes };
      const result = await scanner.scan(contextWithHtml);

      expect(result.status).toBe('warn');
      expect(result.details?.specificData?.aiRelevantTypes).toContain('FAQPage');
      expect(result.details?.specificData?.aiRelevantTypes).toContain('HowTo');
    });
  });

  describe('Invalid JSON-LD scenarios', () => {
    it('should handle invalid JSON gracefully', async () => {
      const htmlWithInvalidJson = `
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
            { invalid json here }
            </script>
          </head>
        </html>
      `;

      const contextWithHtml = { ...mockContext, pageHtml: htmlWithInvalidJson };
      const result = await scanner.scan(contextWithHtml);

      // Should still process the valid JSON-LD
      expect(result.status).toBe('pass');
      expect(result.details?.specificData?.count).toBe(1);
      expect(result.details?.specificData?.types).toContain('Organization');
    });

    it('should warn for missing required fields', async () => {
      const htmlWithIncomplete = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Organization"
            }
            </script>
          </head>
        </html>
      `;

      const contextWithHtml = { ...mockContext, pageHtml: htmlWithIncomplete };
      const result = await scanner.scan(contextWithHtml);

      expect(result.status).toBe('warn');
      expect(result.details?.validationIssues).toContain('Missing @context property');
    });

    it('should validate Organization required fields', async () => {
      const htmlWithIncompleteOrg = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization"
            }
            </script>
          </head>
        </html>
      `;

      const contextWithHtml = { ...mockContext, pageHtml: htmlWithIncompleteOrg };
      const result = await scanner.scan(contextWithHtml);

      expect(result.status).toBe('warn');
      expect(result.details?.validationIssues).toContain('Organization missing name property');
      expect(result.details?.validationIssues).toContain('Organization missing url property');
    });

    it('should validate Article required fields', async () => {
      const htmlWithIncompleteArticle = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Article"
            }
            </script>
          </head>
        </html>
      `;

      const contextWithHtml = { ...mockContext, pageHtml: htmlWithIncompleteArticle };
      const result = await scanner.scan(contextWithHtml);

      expect(result.status).toBe('warn');
      expect(result.details?.validationIssues).toContain('Article missing headline property');
      expect(result.details?.validationIssues).toContain('Article missing author property');
      expect(result.details?.validationIssues).toContain('Article missing datePublished property');
    });
  });

  describe('Nested schema handling', () => {
    it('should extract types from nested objects', async () => {
      const htmlWithNested = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Article",
              "headline": "Great Article",
              "author": {
                "@type": "Person",
                "name": "John Doe"
              },
              "publisher": {
                "@type": "Organization",
                "name": "Example Publisher"
              }
            }
            </script>
          </head>
        </html>
      `;

      const contextWithHtml = { ...mockContext, pageHtml: htmlWithNested };
      const result = await scanner.scan(contextWithHtml);

      expect(result.status).toBe('pass');
      expect(result.details?.specificData?.types).toContain('Article');
      expect(result.details?.specificData?.types).toContain('Person');
      expect(result.details?.specificData?.types).toContain('Organization');
    });

    it('should handle array of types', async () => {
      const htmlWithArrayTypes = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": ["Article", "NewsArticle"],
              "headline": "Breaking News"
            }
            </script>
          </head>
        </html>
      `;

      const contextWithHtml = { ...mockContext, pageHtml: htmlWithArrayTypes };
      const result = await scanner.scan(contextWithHtml);

      expect(result.status).toBe('warn');
      expect(result.details?.specificData?.types).toContain('Article');
      expect(result.details?.specificData?.types).toContain('NewsArticle');
    });
  });

  describe('Scoring logic', () => {
    it('should give higher scores for comprehensive schemas', async () => {
      const comprehensiveHtml = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Example Company",
              "url": "https://example.com"
            }
            </script>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Example Site",
              "url": "https://example.com"
            }
            </script>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": []
            }
            </script>
          </head>
        </html>
      `;

      const contextWithHtml = { ...mockContext, pageHtml: comprehensiveHtml };
      const result = await scanner.scan(contextWithHtml);

      expect(result.status).toBe('pass');
      expect(result.score).toBe(1.0);
    });

    it('should give lower scores for validation issues', async () => {
      const problematicHtml = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@type": "Organization"
            }
            </script>
          </head>
        </html>
      `;

      const contextWithHtml = { ...mockContext, pageHtml: problematicHtml };
      const result = await scanner.scan(contextWithHtml);

      expect(result.status).toBe('warn');
      expect(result.score).toBeLessThan(0.8);
    });
  });

  describe('Message generation', () => {
    it('should generate appropriate messages for different scenarios', async () => {
      // No JSON-LD
      let result = await scanner.scan({ ...mockContext, pageHtml: '<html></html>' });
      expect(result.message).toBe('No JSON-LD structured data found');

      // With validation issues
      const htmlWithIssues = `
        <html>
          <head>
            <script type="application/ld+json">
            { "@type": "Organization" }
            </script>
          </head>
        </html>
      `;
      result = await scanner.scan({ ...mockContext, pageHtml: htmlWithIssues });
      expect(result.message).toContain('validation issues');

      // With AI-relevant types
      const htmlWithAiTypes = `
        <html>
          <head>
            <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": []
            }
            </script>
          </head>
        </html>
      `;
      result = await scanner.scan({ ...mockContext, pageHtml: htmlWithAiTypes });
      expect(result.message).toContain('AI-relevant types');
    });
  });
});