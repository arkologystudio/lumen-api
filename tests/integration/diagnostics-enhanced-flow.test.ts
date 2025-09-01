import { DiagnosticAggregator, LighthouseAIReport } from '../../src/services/diagnostics/aggregator';
import { ScannerResult } from '../../src/services/diagnostics/scanners/base';

describe('Spec-Compliant Diagnostics Flow Integration', () => {
  let aggregator: DiagnosticAggregator;

  beforeEach(() => {
    aggregator = new DiagnosticAggregator();
  });

  describe('Spec-Compliant Aggregator Integration', () => {
    it('should produce spec-compliant response structure with real scanner results', () => {
      // Create realistic scanner results with 0-1 scoring
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        {
          indicatorName: 'llms_txt',
          category: 'standards',
          status: 'fail',
          score: 0.0,
          weight: 2.0,
          message: 'No llms.txt file found',
          details: {
            found: false,
            statusCode: 404,
            score: 0,
            metadata: {
              error: 'File not found'
            }
          },
          recommendation: 'Create an llms.txt file',
          checkedUrl: 'https://example.com/llms.txt',
          found: false,
          isValid: false
        },
        {
          indicatorName: 'seo_basic',
          category: 'seo',
          status: 'pass',
          score: 1.0,
          weight: 1.5,
          message: 'Basic SEO elements found',
          details: {
            found: true,
            score: 100,
            analysis: {
              title: { 
                exists: true, 
                optimal: true,
                title: 'Example Title',
                length: 13
              },
              metaDescription: { 
                exists: true, 
                optimal: true,
                metaDescription: 'Example description',
                length: 19
              },
              headings: { 
                structure: ['h1', 'h2'],
                h1Count: 1,
                hasH1: true,
                hierarchy: true
              },
              openGraph: { 
                hasTitle: true,
                hasDescription: true,
                hasImage: false,
                hasUrl: false,
                hasType: false,
                score: 0.6
              }
            }
          },
          found: true,
          isValid: true
        },
        {
          indicatorName: 'json_ld',
          category: 'structured_data',
          status: 'warn',
          score: 0.6,
          weight: 2.0,
          message: 'JSON-LD found but missing some elements',
          details: {
            found: true,
            score: 60,
            analysis: {
              found: true,
              count: 1,
              types: ['Organization'],
              schemas: ['Organization'],
              hasOrganization: true,
              hasWebSite: false,
              hasWebPage: false,
              hasBreadcrumb: false,
              hasProduct: false,
              hasArticle: false,
              validationIssues: [],
              aiRelevantTypes: ['Organization']
            },
            validation: {
              errors: ['Missing WebSite schema']
            }
          },
          recommendation: 'Add WebSite schema for better coverage',
          found: true,
          isValid: true
        },
        {
          indicatorName: 'mcp',
          category: 'standards',
          status: 'fail',
          score: 0.0,
          weight: 2.5,
          message: 'No MCP configuration found',
          details: {
            found: false,
            score: 0,
            validation: {
              errors: ['MCP configuration file not found']
            }
          },
          recommendation: 'Implement MCP configuration',
          found: false,
          isValid: false
        }
      ]);
      
      const result: LighthouseAIReport = aggregator.aggregate(
        'https://example.com',
        pageResults,
        'ecommerce' // Declare as e-commerce to test applicability
      );

      // Verify spec-compliant structure
      expect(result).toBeDefined();
      expect(result.site.url).toBe('https://example.com');
      expect(result.site.category).toBe('ecommerce');
      expect(result.site.scan_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify category structure
      expect(result.categories.discovery).toBeDefined();
      expect(result.categories.understanding).toBeDefined();
      expect(result.categories.actions).toBeDefined();
      expect(result.categories.trust).toBeDefined();

      // Verify weights match specification
      expect(result.weights.discovery).toBe(0.30);
      expect(result.weights.understanding).toBe(0.30);
      expect(result.weights.actions).toBe(0.25);
      expect(result.weights.trust).toBe(0.15);

      // Verify overall score
      expect(result.overall.raw_0_1).toBeGreaterThanOrEqual(0);
      expect(result.overall.raw_0_1).toBeLessThanOrEqual(1);
      expect(result.overall.score_0_100).toBe(Math.round(result.overall.raw_0_1 * 100));

      // Verify indicators have applicability
      const allIndicators = Object.values(result.categories).flatMap(c => c.indicators);
      expect(allIndicators.length).toBeGreaterThan(0);
      
      allIndicators.forEach(indicator => {
        expect(indicator.applicability).toBeDefined();
        expect(['required', 'optional', 'not_applicable']).toContain(indicator.applicability.status);
        expect(typeof indicator.applicability.included_in_category_math).toBe('boolean');
        expect(indicator.score).toBeGreaterThanOrEqual(0);
        expect(indicator.score).toBeLessThanOrEqual(1);
      });

      // Verify MCP is required for e-commerce
      const mcpIndicator = result.categories.actions.indicators.find(i => i.name === 'mcp');
      if (mcpIndicator) {
        expect(mcpIndicator.applicability.status).toBe('required');
        expect(mcpIndicator.applicability.included_in_category_math).toBe(true);
      }
    });

    it('should handle blog content profile with different applicability', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://blog.example.com', [
        {
          indicatorName: 'llms_txt',
          category: 'standards',
          status: 'pass',
          score: 1.0,
          weight: 2.0,
          message: 'Valid llms.txt found',
          details: { found: true, score: 100 },
          recommendation: 'Test recommendation',
          found: true,
          isValid: true
        },
        {
          indicatorName: 'mcp',
          category: 'standards',
          status: 'fail',
          score: 0.0,
          weight: 2.5,
          message: 'No MCP configuration found',
          details: { found: false, score: 0 },
          recommendation: 'Test recommendation',
          found: false,
          isValid: false
        }
      ]);
      
      const result: LighthouseAIReport = aggregator.aggregate(
        'https://blog.example.com',
        pageResults,
        'blog_content'
      );

      expect(result.site.category).toBe('blog_content');

      // MCP should be not applicable for blog content
      const mcpIndicator = result.categories.actions.indicators.find(i => i.name === 'mcp');
      if (mcpIndicator) {
        expect(mcpIndicator.applicability.status).toBe('not_applicable');
        expect(mcpIndicator.applicability.included_in_category_math).toBe(false);
      }

      // llms.txt should be required for blog content  
      const llmsIndicator = result.categories.understanding.indicators.find(i => i.name === 'llms_txt');
      if (llmsIndicator) {
        expect(llmsIndicator.applicability.status).toBe('required');
        expect(llmsIndicator.applicability.included_in_category_math).toBe(true);
      }
    });

    it('should calculate category scores excluding non-applicable indicators', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://blog.example.com', [
        {
          indicatorName: 'llms_txt',
          category: 'standards',
          status: 'pass',
          score: 1.0,
          message: 'Test message',
          details: { found: true, score: 100 },
          recommendation: 'Test recommendation',
          found: true,
          isValid: true
        },
        {
          indicatorName: 'mcp', // Not applicable for blog
          category: 'standards',
          status: 'fail',
          score: 0.0,
          message: 'Test message',
          details: { found: false, score: 0 },
          recommendation: 'Test recommendation',
          found: false,
          isValid: false
        },
        {
          indicatorName: 'robots_txt',
          category: 'standards',
          status: 'pass',
          score: 1.0,
          message: 'Test message',
          details: { found: true, score: 100 },
          recommendation: 'Test recommendation',
          found: true,
          isValid: true
        }
      ]);
      
      const result: LighthouseAIReport = aggregator.aggregate(
        'https://blog.example.com',
        pageResults,
        'blog_content'
      );

      // Actions category should not be penalized by MCP failure since it's not applicable
      const actionsCategory = result.categories.actions;
      
      // Since MCP is not applicable for blogs, actions category should have score 0 
      // (no applicable indicators)
      expect(actionsCategory.score).toBe(0);
    });
  });
});