import { DiagnosticAggregator } from '../../src/services/diagnostics/aggregator';
import { initializeScanners } from '../../src/services/diagnostics/scanners';

describe('Enhanced Diagnostics Flow Integration', () => {
  let aggregator: DiagnosticAggregator;

  beforeEach(() => {
    aggregator = new DiagnosticAggregator();

    // Mock fetch for scanner network requests
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Enhanced Aggregator Integration', () => {
    it('should produce enhanced response structure with real scanner results', () => {
      // Create realistic scanner results
      const pageResults = new Map();
      
      pageResults.set('https://example.com', [
        {
          indicatorName: 'llms_txt',
          category: 'standards',
          status: 'fail',
          score: 0,
          weight: 2.0,
          message: 'No llms.txt file found',
          details: {
            error: 'File not found',
            statusCode: 404
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
          score: 8,
          weight: 1.5,
          message: 'Basic SEO elements found',
          details: {
            title: { exists: true, optimal: true },
            metaDescription: { exists: true, optimal: true },
            headings: { hasH1: true, h1Count: 1 },
            openGraph: { hasBasicOg: true, missingTags: [] }
          },
          found: true,
          isValid: true
        },
        {
          indicatorName: 'json_ld',
          category: 'structured_data',
          status: 'warn',
          score: 6,
          weight: 2.0,
          message: 'JSON-LD found but missing some elements',
          details: {
            found: true,
            schemas: ['Organization'],
            validationIssues: ['Missing WebSite schema']
          },
          recommendation: 'Add WebSite schema for better coverage',
          found: true,
          isValid: true
        }
      ]);

      const scanStarted = new Date('2024-01-01T00:00:00Z');
      const scanCompleted = new Date('2024-01-01T00:00:10Z');
      
      const result = aggregator.aggregate(
        'test-audit-123',
        'https://example.com',
        pageResults,
        'quick',
        scanStarted,
        scanCompleted
      );

      // Verify enhanced structure
      expect(result).toBeDefined();
      expect(result.auditType).toBe('quick');
      expect(result.scanMetadata).toBeDefined();
      expect(result.scanMetadata.version).toBe('2.0');
      expect(result.scanMetadata.duration).toBe(10000); // 10 seconds

      // Verify enhanced page data
      expect(result.pages).toHaveLength(1);
      const page = result.pages[0];
      
      expect(page.indicators).toHaveLength(3);
      expect(page.issues).toBeDefined();
      expect(page.recommendations).toBeDefined();

      // Verify individual indicators are enhanced
      const llmsIndicator = page.indicators.find(i => i.name === 'llms_txt');
      expect(llmsIndicator).toBeDefined();
      expect(llmsIndicator!.displayName).toBe('LLMS.txt File');
      expect(llmsIndicator!.description).toContain('AI agent instruction file');
      expect(llmsIndicator!.maxScore).toBe(10);
      expect(llmsIndicator!.details).toBeDefined();
      expect(llmsIndicator!.scannedAt).toBeDefined();

      // Verify category scores are enhanced
      expect(result.categoryScores.length).toBeGreaterThan(0);
      const standardsCategory = result.categoryScores.find(c => c.category === 'standards');
      expect(standardsCategory).toBeDefined();
      expect(standardsCategory!.displayName).toBe('AI Standards');
      expect(standardsCategory!.description).toBeDefined();
      expect(standardsCategory!.categoryInsights).toBeDefined();

      // Verify AI readiness details
      expect(result.aiReadinessDetails).toBeDefined();
      expect(result.aiReadinessDetails.factors).toBeDefined();
      expect(result.aiReadinessDetails.factors.hasLlmsTxt).toBe(false);
      // Note: hasStructuredData depends on the specific JSON-LD indicator name and status
      // The aggregator looks for 'json_ld' with 'pass' status for structured data
      expect(result.aiReadinessDetails.factors.hasStructuredData).toBe(false); // Because json_ld is 'warn', not 'pass'
      expect(result.aiReadinessDetails.missingElements).toContain('llms.txt file');

      // Verify enhanced summary
      expect(result.summary.completionPercentage).toBeDefined();
      expect(result.summary.aiReadinessPercentage).toBeDefined();
      expect(result.summary.quickWins).toBeDefined();
      expect(result.summary.strategicImprovements).toBeDefined();
      expect(result.summary.complianceLevel).toBeDefined();

      // Verify prioritized recommendations
      expect(result.summary.topRecommendations).toBeDefined();
      if (result.summary.topRecommendations.length > 0) {
        const topRec = result.summary.topRecommendations[0];
        expect(topRec.indicatorName).toBeDefined();
        expect(topRec.priority).toBeDefined();
        expect(topRec.expectedImprovement).toBeDefined();
        expect(topRec.estimatedEffort).toBeDefined();
      }
    });

    it('should handle mixed indicator results correctly', () => {
      const pageResults = new Map();
      
      // Simulate results from all 8 core indicators
      pageResults.set('https://example.com', [
        { indicatorName: 'llms_txt', category: 'standards', status: 'fail', score: 0, weight: 2.0, recommendation: 'Create llms.txt file' },
        { indicatorName: 'agent_json', category: 'standards', status: 'fail', score: 0, weight: 2.0, recommendation: 'Add agent.json configuration' },
        { indicatorName: 'ai_agent_json', category: 'standards', status: 'fail', score: 0, weight: 1.5, recommendation: 'Implement AI agent configuration' },
        { indicatorName: 'robots_txt', category: 'seo', status: 'pass', score: 8, weight: 1.5 },
        { indicatorName: 'canonical_urls', category: 'seo', status: 'pass', score: 9, weight: 1.0 },
        { indicatorName: 'sitemap_xml', category: 'seo', status: 'warn', score: 6, weight: 1.5, recommendation: 'Improve sitemap coverage' },
        { indicatorName: 'seo_basic', category: 'seo', status: 'pass', score: 9, weight: 1.5 },
        { indicatorName: 'json_ld', category: 'structured_data', status: 'warn', score: 5, weight: 2.0, recommendation: 'Add more structured data schemas' }
      ]);

      const result = aggregator.aggregate(
        'test-audit-456',
        'https://example.com',
        pageResults,
        'full',
        new Date(),
        new Date()
      );

      // Should have all 3 categories represented
      expect(result.categoryScores).toHaveLength(3);
      
      // Standards category should have low score due to failures
      const standardsCategory = result.categoryScores.find(c => c.category === 'standards');
      expect(standardsCategory).toBeDefined();
      expect(standardsCategory!.score).toBeLessThan(5);
      expect(standardsCategory!.failedCount).toBe(3);

      // SEO category should have higher score
      const seoCategory = result.categoryScores.find(c => c.category === 'seo');
      expect(seoCategory).toBeDefined();
      expect(seoCategory!.score).toBeGreaterThan(6);
      expect(seoCategory!.passedCount).toBe(3);
      expect(seoCategory!.warningCount).toBe(1);

      // AI readiness should reflect poor standards compliance
      expect(result.aiReadinessDetails.factors.hasLlmsTxt).toBe(false);
      expect(result.aiReadinessDetails.factors.hasAgentConfig).toBe(false);
      expect(result.aiReadiness).toBe('poor'); // Low overall score due to failed standards

      // Should have actionable recommendations (may be strategic rather than quick wins)
      expect(result.summary.quickWins.length + result.summary.strategicImprovements.length).toBeGreaterThan(0);
      expect(result.summary.criticalIssues.length).toBeGreaterThan(0);
    });

    it('should calculate accurate scoring and prioritization', () => {
      const pageResults = new Map();
      
      pageResults.set('https://example.com', [
        {
          indicatorName: 'critical_standards_fail',
          category: 'standards',
          status: 'fail',
          score: 0,
          weight: 3.0,
          message: 'Critical AI standards failure',
          recommendation: 'Implement AI standards immediately'
        },
        {
          indicatorName: 'minor_seo_issue',
          category: 'seo',
          status: 'warn',
          score: 7,
          weight: 1.0,
          message: 'Minor SEO issue',
          recommendation: 'Optimize SEO when convenient'
        }
      ]);

      const result = aggregator.aggregate(
        'test-audit-789',
        'https://example.com',
        pageResults,
        'quick',
        new Date(),
        new Date()
      );

      // Critical issue should be identified
      expect(result.summary.criticalIssues.length).toBeGreaterThan(0);
      const criticalIssue = result.summary.criticalIssues[0];
      expect(criticalIssue.severity).toBe('critical');
      expect(criticalIssue.indicatorName).toBe('critical_standards_fail');

      // Recommendations should be prioritized correctly
      expect(result.summary.topRecommendations.length).toBeGreaterThan(0);
      const topRec = result.summary.topRecommendations[0];
      expect(topRec.priority).toBe('high'); // High weight failure should be high priority
      expect(topRec.indicatorName).toBe('critical_standards_fail');

      // Site score should reflect the critical failure
      expect(result.siteScore.overall).toBeLessThan(5);
      expect(result.siteScore.weighted).toBeLessThan(result.siteScore.overall); // Weighted should be lower due to standards weight
    });
  });

  describe('Scanner Registry Integration', () => {
    it('should initialize all 8 core scanners with enhanced details', () => {
      const registry = initializeScanners();
      
      const scannerNames = registry.getAllScanners().map(s => s.name);
      
      // Verify all 8 core indicators are present
      expect(scannerNames).toContain('llms_txt');
      expect(scannerNames).toContain('agent_json');
      expect(scannerNames).toContain('ai_agent_json');
      expect(scannerNames).toContain('robots_txt');
      expect(scannerNames).toContain('canonical_urls');
      expect(scannerNames).toContain('xml_sitemap');
      expect(scannerNames).toContain('seo_basic');
      expect(scannerNames).toContain('json_ld');

      // Verify each scanner has the required metadata
      registry.getAllScanners().forEach(scanner => {
        expect(scanner.name).toBeDefined();
        expect(scanner.category).toBeDefined();
        expect(scanner.description).toBeDefined();
        expect(scanner.weight).toBeGreaterThan(0);
      });
    });
  });
});