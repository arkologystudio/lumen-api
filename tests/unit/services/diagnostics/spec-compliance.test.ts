import { SiteProfileDetector } from '../../../../src/services/diagnostics/profileDetector';
import { ApplicabilityMatrix } from '../../../../src/services/diagnostics/applicabilityMatrix';
import { SpecCompliantAggregator } from '../../../../src/services/diagnostics/specAggregator';
import { McpScanner } from '../../../../src/services/diagnostics/scanners/mcp.scanner';
import { ScannerContext, ScannerResult } from '../../../../src/services/diagnostics/scanners/base';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Spec Compliance Tests', () => {
  describe('SiteProfileDetector', () => {
    let detector: SiteProfileDetector;

    beforeEach(() => {
      detector = new SiteProfileDetector();
    });

    it('should detect e-commerce profile from Product schema', () => {
      const indicators: ScannerResult[] = [
        {
          indicatorName: 'json_ld',
          category: 'structured_data',
          status: 'pass',
          details: {
            found: true,
            score: 100,
            analysis: {
              found: true,
              count: 2,
              types: ['Product', 'Offer'],
              schemas: ['Product', 'Offer'],
              hasOrganization: false,
              hasWebSite: false,
              hasWebPage: false,
              hasBreadcrumb: false,
              hasProduct: true,
              hasArticle: false,
              validationIssues: [],
              aiRelevantTypes: ['Product', 'Offer']
            }
          },
          message: 'Test message',
          recommendation: 'Test recommendation',
          found: true,
          isValid: true
        }
      ];

      const result = detector.detectProfile(indicators, ['/products', '/cart']);
      
      expect(result.profile).toBe('ecommerce');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.signals).toContain('Product/Offer schema detected');
      expect(result.signals).toContain('E-commerce URL patterns');
    });

    it('should detect blog content profile from Article schema', () => {
      const indicators: ScannerResult[] = [
        {
          indicatorName: 'json_ld',
          category: 'structured_data',
          status: 'pass',
          details: {
            found: true,
            score: 100,
            analysis: {
              found: true,
              count: 2,
              types: ['Article', 'BlogPosting'],
              schemas: ['Article', 'BlogPosting'],
              hasOrganization: false,
              hasWebSite: false,
              hasWebPage: false,
              hasBreadcrumb: false,
              hasProduct: false,
              hasArticle: true,
              validationIssues: [],
              aiRelevantTypes: ['Article', 'BlogPosting']
            }
          },
          message: 'Test message',
          recommendation: 'Test recommendation',
          found: true,
          isValid: true
        }
      ];

      const result = detector.detectProfile(indicators, ['/blog/post-1', '/blog/post-2']);
      
      expect(result.profile).toBe('blog_content');
      expect(result.signals).toContain('Article/Blog schema detected');
    });

    it('should use declared profile when provided', () => {
      const result = detector.detectProfile([], [], 'saas_app');
      
      expect(result.profile).toBe('saas_app');
      expect(result.confidence).toBe(1.0);
      expect(result.method).toBe('declared');
    });

    it('should default to custom when no clear signals', () => {
      const result = detector.detectProfile([], ['/page1', '/page2']);
      
      expect(result.profile).toBe('custom');
      expect(result.signals).toContain('No clear profile signals detected');
    });
  });

  describe('ApplicabilityMatrix', () => {
    let matrix: ApplicabilityMatrix;

    beforeEach(() => {
      matrix = new ApplicabilityMatrix();
    });

    it('should mark MCP as required for e-commerce', () => {
      const applicability = matrix.getApplicability('mcp', 'ecommerce');
      
      expect(applicability.status).toBe('required');
      expect(applicability.included_in_category_math).toBe(true);
    });

    it('should mark MCP as not applicable for blog content', () => {
      const applicability = matrix.getApplicability('mcp', 'blog_content');
      
      expect(applicability.status).toBe('not_applicable');
      expect(applicability.included_in_category_math).toBe(false);
    });

    it('should mark llms.txt as required for knowledge base', () => {
      const applicability = matrix.getApplicability('llms_txt', 'kb_support');
      
      expect(applicability.status).toBe('required');
      expect(applicability.included_in_category_math).toBe(true);
    });

    it('should mark JSON-LD as required for all profiles', () => {
      const profiles = ['blog_content', 'ecommerce', 'saas_app', 'kb_support', 'gov_nontransacting', 'custom'];
      
      for (const profile of profiles) {
        const applicability = matrix.getApplicability('json_ld', profile as any);
        expect(applicability.status).toBe('required');
      }
    });
  });

  describe('SpecCompliantAggregator', () => {
    let aggregator: SpecCompliantAggregator;

    beforeEach(() => {
      aggregator = new SpecCompliantAggregator();
    });

    it('should calculate scores in 0-1 range', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', [
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
          indicatorName: 'json_ld',
          category: 'structured_data',
          status: 'warn',
          score: 0.5,
          message: 'Test message',
          details: { found: true, score: 50 },
          recommendation: 'Test recommendation',
          found: true,
          isValid: true
        },
        {
          indicatorName: 'seo_basic',
          category: 'seo',
          status: 'fail',
          score: 0.0,
          message: 'Test message',
          details: { found: false, score: 0 },
          recommendation: 'Test recommendation',
          found: false,
          isValid: false
        }
      ]);

      const result = aggregator.aggregate('https://example.com', pageResults);
      
      expect(result.overall.raw_0_1).toBeGreaterThanOrEqual(0);
      expect(result.overall.raw_0_1).toBeLessThanOrEqual(1);
      expect(result.overall.score_0_100).toBe(Math.round(result.overall.raw_0_1 * 100));
    });

    it('should respect applicability matrix', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://blog.example.com', [
        {
          indicatorName: 'mcp', // Not applicable for blogs
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
          indicatorName: 'llms_txt', // Required for blogs
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

      const result = aggregator.aggregate(
        'https://blog.example.com', 
        pageResults,
        'blog_content' // Declare as blog
      );
      
      // Find MCP indicator
      const mcpIndicator = result.categories.actions.indicators.find(i => i.name === 'mcp');
      if (mcpIndicator) {
        expect(mcpIndicator.applicability.status).toBe('not_applicable');
        expect(mcpIndicator.applicability.included_in_category_math).toBe(false);
      }
      
      // Find llms.txt indicator
      const llmsIndicator = result.categories.understanding.indicators.find(i => i.name === 'llms_txt');
      if (llmsIndicator) {
        expect(llmsIndicator.applicability.status).toBe('required');
        expect(llmsIndicator.applicability.included_in_category_math).toBe(true);
      }
    });

    it('should use correct category weights', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', []);

      const result = aggregator.aggregate('https://example.com', pageResults);
      
      expect(result.weights.discovery).toBe(0.30);
      expect(result.weights.understanding).toBe(0.30);
      expect(result.weights.actions).toBe(0.25);
      expect(result.weights.trust).toBe(0.15);
      
      // Weights should sum to 1.0
      const sum = result.weights.discovery + result.weights.understanding + 
                  result.weights.actions + result.weights.trust;
      expect(sum).toBeCloseTo(1.0);
    });
  });

  describe('McpScanner', () => {
    let scanner: McpScanner;

    beforeEach(() => {
      scanner = new McpScanner();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should detect valid MCP configuration', async () => {
      const validMcpConfig = {
        version: '1.0',
        capabilities: ['search', 'action'],
        server: {
          url: 'https://api.example.com/mcp'
        },
        actions: [
          {
            name: 'search',
            description: 'Search content',
            parameters: {}
          }
        ]
      };

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: JSON.stringify(validMcpConfig),
        headers: {}
      });

      const context: ScannerContext = {
        auditId: 'test',
        siteUrl: 'https://example.com'
      };

      const result = await scanner.scan(context);
      
      expect(result.status).toBe('pass');
      expect(result.score).toBe(1.0);
      expect(result.found).toBe(true);
      expect(result.isValid).toBe(true);
      expect((result.details?.analysis as any)?.actionCount).toBe(1);
    });

    it('should fail when MCP is not found', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 404,
        data: '',
        headers: {}
      });

      const context: ScannerContext = {
        auditId: 'test',
        siteUrl: 'https://example.com'
      };

      const result = await scanner.scan(context);
      
      expect(result.status).toBe('fail');
      expect(result.score).toBe(0.0);
      expect(result.found).toBe(false);
      expect(result.isValid).toBe(false);
    });

    it('should warn on invalid MCP configuration', async () => {
      const invalidMcpConfig = {
        // Missing required 'version' field
        capabilities: ['search']
      };

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: JSON.stringify(invalidMcpConfig),
        headers: {}
      });

      const context: ScannerContext = {
        auditId: 'test',
        siteUrl: 'https://example.com'
      };

      const result = await scanner.scan(context);
      
      expect(result.status).toBe('warn');
      expect(result.score).toBe(0.5);
      expect(result.found).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.details?.validation?.errors).toContain('Missing required field: version');
    });
  });
});