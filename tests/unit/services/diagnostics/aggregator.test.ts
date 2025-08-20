import { DiagnosticAggregator, LighthouseAIReport } from '../../../../src/services/diagnostics/aggregator';
import { ScannerResult } from '../../../../src/services/diagnostics/scanners/base';

describe('Spec-Compliant DiagnosticAggregator', () => {
  let aggregator: DiagnosticAggregator;

  beforeEach(() => {
    aggregator = new DiagnosticAggregator();
  });

  const createMockScannerResult = (
    name: string,
    category: 'standards' | 'seo' | 'structured_data',
    status: 'pass' | 'warn' | 'fail',
    score: number,
    weight: number = 1.0
  ): ScannerResult => ({
    indicatorName: name,
    category,
    status,
    score,
    weight,
    message: `${name} ${status}`,
    details: { test: true }
  });

  describe('Spec-compliant aggregation', () => {
    it('should aggregate single page results with spec format', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('llms_txt', 'standards', 'pass', 1.0, 2.0),
        createMockScannerResult('seo_basic', 'seo', 'warn', 0.6, 1.5),
        createMockScannerResult('json_ld', 'structured_data', 'fail', 0.0, 2.5)
      ]);

      const result: LighthouseAIReport = aggregator.aggregate('https://example.com', pageResults);

      expect(result.site.url).toBe('https://example.com');
      expect(result.site.category).toBeDefined();
      expect(result.site.scan_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Check categories exist
      expect(result.categories.discovery).toBeDefined();
      expect(result.categories.understanding).toBeDefined();
      expect(result.categories.actions).toBeDefined();
      expect(result.categories.trust).toBeDefined();
      
      // Check weights match spec
      expect(result.weights.discovery).toBe(0.30);
      expect(result.weights.understanding).toBe(0.30);
      expect(result.weights.actions).toBe(0.25);
      expect(result.weights.trust).toBe(0.15);
      
      // Check overall score calculation
      expect(result.overall.raw_0_1).toBeGreaterThanOrEqual(0);
      expect(result.overall.raw_0_1).toBeLessThanOrEqual(1);
      expect(result.overall.score_0_100).toBe(Math.round(result.overall.raw_0_1 * 100));
    });

    it('should handle multiple pages with proper category distribution', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('llms_txt', 'standards', 'pass', 1.0),
        createMockScannerResult('seo_basic', 'seo', 'pass', 1.0)
      ]);
      
      pageResults.set('https://example.com/about', [
        createMockScannerResult('json_ld', 'structured_data', 'warn', 0.5),
        createMockScannerResult('robots_txt', 'standards', 'pass', 1.0, 0) // Zero weight
      ]);

      const result: LighthouseAIReport = aggregator.aggregate('https://example.com', pageResults);

      expect(result.site.url).toBe('https://example.com');
      
      // Should have indicators distributed across categories
      const allIndicators = Object.values(result.categories).flatMap(c => c.indicators);
      expect(allIndicators.length).toBeGreaterThan(0);
      
      // Each indicator should have valid applicability
      allIndicators.forEach(indicator => {
        expect(indicator.applicability).toBeDefined();
        expect(['required', 'optional', 'not_applicable']).toContain(indicator.applicability.status);
      });
    });

    it('should calculate category scores correctly', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('seo_basic', 'seo', 'pass', 1.0), // Discovery category
        createMockScannerResult('sitemap_xml', 'seo', 'pass', 1.0), // Discovery category 
        createMockScannerResult('json_ld', 'structured_data', 'warn', 0.5), // Understanding
        createMockScannerResult('llms_txt', 'standards', 'fail', 0.0), // Understanding
      ]);

      const result: LighthouseAIReport = aggregator.aggregate('https://example.com', pageResults);

      // Discovery should have high score (both SEO indicators pass)
      expect(result.categories.discovery.score).toBeGreaterThan(0.8);
      
      // Understanding should have medium score (one pass, one fail)
      expect(result.categories.understanding.score).toBeLessThan(0.8);
      expect(result.categories.understanding.score).toBeGreaterThan(0.2);
    });

    it('should respect profile-based applicability', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://blog.example.com', [
        createMockScannerResult('mcp', 'standards', 'fail', 0.0), // Not applicable for blogs
        createMockScannerResult('llms_txt', 'standards', 'pass', 1.0), // Required for blogs
      ]);

      const result: LighthouseAIReport = aggregator.aggregate(
        'https://blog.example.com', 
        pageResults,
        'blog_content'
      );

      expect(result.site.category).toBe('blog_content');
      
      const mcpIndicator = result.categories.actions.indicators.find(i => i.name === 'mcp');
      if (mcpIndicator) {
        expect(mcpIndicator.applicability.status).toBe('not_applicable');
        expect(mcpIndicator.applicability.included_in_category_math).toBe(false);
      }
      
      const llmsIndicator = result.categories.understanding.indicators.find(i => i.name === 'llms_txt');
      if (llmsIndicator) {
        expect(llmsIndicator.applicability.status).toBe('required');
        expect(llmsIndicator.applicability.included_in_category_math).toBe(true);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle empty page results', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      const result: LighthouseAIReport = aggregator.aggregate('https://example.com', pageResults);

      expect(result.site.url).toBe('https://example.com');
      expect(result.overall.raw_0_1).toBe(0);
      expect(result.overall.score_0_100).toBe(0);
      
      // All categories should have score 0 when no indicators
      expect(result.categories.discovery.score).toBe(0);
      expect(result.categories.understanding.score).toBe(0);
      expect(result.categories.actions.score).toBe(0);
      expect(result.categories.trust.score).toBe(0);
    });

    it('should handle all non-applicable indicators', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://blog.example.com', [
        createMockScannerResult('mcp', 'standards', 'fail', 0.0), // Not applicable for blogs
      ]);

      const result: LighthouseAIReport = aggregator.aggregate(
        'https://blog.example.com', 
        pageResults,
        'blog_content'
      );

      // Actions category should have score 0 (no applicable indicators)
      expect(result.categories.actions.score).toBe(0);
      
      // Overall score should still be calculated properly
      expect(result.overall.raw_0_1).toBeGreaterThanOrEqual(0);
      expect(result.overall.raw_0_1).toBeLessThanOrEqual(1);
    });
  });
});