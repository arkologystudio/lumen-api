import {
  BaseScanner,
  ScannerContext,
  ScannerResult,
  IndicatorCategory
} from '../../../../../src/services/diagnostics/scanners/base';

// Create a concrete test implementation of BaseScanner
class TestScanner extends BaseScanner {
  name = 'test_scanner';
  category: IndicatorCategory = 'standards';
  description = 'Test scanner for unit tests';
  weight = 1.5;

  async scan(context: ScannerContext): Promise<ScannerResult> {
    return this.createResult({
      status: 'pass',
      score: 10,
      message: 'Test scanner passed',
      details: this.createStandardEvidence({
        found: true,
        score: 100,
        analysis: { 
          found: false,
          count: 0,
          types: [],
          hasOrganization: false,
          hasWebSite: false,
          hasWebPage: false,
          hasBreadcrumb: false,
          hasProduct: false,
          hasArticle: false,
          validationIssues: [],
          aiRelevantTypes: []
        }
      })
    });
  }
}

class ConditionalTestScanner extends BaseScanner {
  name = 'conditional_test';
  category: IndicatorCategory = 'seo';
  description = 'Conditional test scanner';

  async scan(context: ScannerContext): Promise<ScannerResult> {
    if (!context.pageHtml) {
      return this.createResult({
        status: 'not_applicable',
        message: 'No HTML available'
      });
    }

    return this.createResult({
      status: 'pass',
      score: 8,
      message: 'Conditional test passed'
    });
  }

  isApplicable(context: ScannerContext): boolean {
    return !!context.pageHtml;
  }
}

describe('BaseScanner', () => {
  let testScanner: TestScanner;
  let conditionalScanner: ConditionalTestScanner;
  let mockContext: ScannerContext;

  beforeEach(() => {
    testScanner = new TestScanner();
    conditionalScanner = new ConditionalTestScanner();
    
    mockContext = {
      auditId: 'audit-123',
      siteUrl: 'https://example.com',
      pageUrl: 'https://example.com/page',
      pageHtml: '<html><head><title>Test Page</title></head><body>Content</body></html>',
      pageMetadata: {
        title: 'Test Page',
        statusCode: 200,
        loadTimeMs: 500
      }
    };
  });

  describe('BaseScanner implementation', () => {
    it('should have correct properties', () => {
      expect(testScanner.name).toBe('test_scanner');
      expect(testScanner.category).toBe('standards');
      expect(testScanner.description).toBe('Test scanner for unit tests');
      expect(testScanner.weight).toBe(1.5);
    });

    it('should return true for isApplicable by default', () => {
      expect(testScanner.isApplicable(mockContext)).toBe(true);
    });

    it('should create result with correct structure', async () => {
      const result = await testScanner.scan(mockContext);

      expect(result.indicatorName).toBe('test_scanner');
      expect(result.category).toBe('standards');
      expect(result.status).toBe('pass');
      expect(result.score).toBe(10);
      expect(result.weight).toBe(1.5);
      expect(result.message).toBe('Test scanner passed');
      expect(result.details.found).toBe(true);
      expect(result.details.score).toBe(100);
      expect(result.details.analysis).toBeDefined();
      // Analysis is properly typed as JsonLdAnalysisData in this test
    });
  });

  describe('createResult helper', () => {
    it('should merge partial results with defaults', async () => {
      const partialResult = await testScanner.scan(mockContext);

      expect(partialResult.indicatorName).toBe(testScanner.name);
      expect(partialResult.category).toBe(testScanner.category);
      expect(partialResult.weight).toBe(testScanner.weight);
    });

    it('should allow overriding default values', () => {
      const result = testScanner['createResult']({
        status: 'warn',
        score: 5,
        weight: 2.0,
        message: 'Custom message'
      });

      expect(result.status).toBe('warn');
      expect(result.score).toBe(5);
      expect(result.weight).toBe(2.0);
      expect(result.message).toBe('Custom message');
    });
  });

  describe('calculateScore helper', () => {
    it('should return correct scores for each status', () => {
      expect(testScanner['calculateScore']('pass')).toBe(1.0);
      expect(testScanner['calculateScore']('warn')).toBe(0.5);
      expect(testScanner['calculateScore']('fail')).toBe(0.0);
      expect(testScanner['calculateScore']('not_applicable')).toBe(0.0);
    });
  });

  describe('Conditional Scanner', () => {
    it('should be applicable when HTML is available', () => {
      expect(conditionalScanner.isApplicable(mockContext)).toBe(true);
    });

    it('should not be applicable when HTML is missing', () => {
      const contextWithoutHtml = { ...mockContext, pageHtml: undefined };
      expect(conditionalScanner.isApplicable(contextWithoutHtml)).toBe(false);
    });

    it('should return not_applicable when HTML is missing', async () => {
      const contextWithoutHtml = { ...mockContext, pageHtml: undefined };
      const result = await conditionalScanner.scan(contextWithoutHtml);

      expect(result.status).toBe('not_applicable');
      expect(result.message).toBe('No HTML available');
    });

    it('should process normally when HTML is available', async () => {
      const result = await conditionalScanner.scan(mockContext);

      expect(result.status).toBe('pass');
      expect(result.score).toBe(8);
      expect(result.message).toBe('Conditional test passed');
    });
  });

  describe('Error handling', () => {
    class ErrorScanner extends BaseScanner {
      name = 'error_scanner';
      category: IndicatorCategory = 'standards';
      description = 'Scanner that throws errors';

      async scan(context: ScannerContext): Promise<ScannerResult> {
        throw new Error('Test error');
      }
    }

    it('should handle scanner errors gracefully in registry context', async () => {
      // This test verifies that scanners throwing errors can be handled
      // by the calling code (like ScannerRegistry)
      const errorScanner = new ErrorScanner();
      
      await expect(errorScanner.scan(mockContext)).rejects.toThrow('Test error');
    });
  });

  describe('Context validation', () => {
    it('should handle minimal context', async () => {
      const minimalContext: ScannerContext = {
        auditId: 'audit-123',
        siteUrl: 'https://example.com'
      };

      const result = await testScanner.scan(minimalContext);
      expect(result.status).toBe('pass');
    });

    it('should handle full context', async () => {
      const fullContext: ScannerContext = {
        auditId: 'audit-123',
        pageId: 'page-456',
        siteUrl: 'https://example.com',
        pageUrl: 'https://example.com/page',
        pageHtml: '<html>Full content</html>',
        pageMetadata: {
          title: 'Full Page',
          metaDescription: 'Full description',
          ogTags: { 'og:title': 'Full OG Title' },
          statusCode: 200,
          loadTimeMs: 300,
          wordCount: 150
        },
        crawlerMetadata: {
          userAgent: 'Test Crawler',
          viewport: { width: 1920, height: 1080 },
          crawledAt: new Date()
        }
      };

      const result = await testScanner.scan(fullContext);
      expect(result.status).toBe('pass');
    });
  });
});