import { DiagnosticAggregator } from '../../../../src/services/diagnostics/aggregator';
import { ScannerResult } from '../../../../src/services/diagnostics/scanners/base';

describe('DiagnosticAggregator', () => {
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

  describe('Basic aggregation', () => {
    it('should aggregate single page results', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('llms_txt', 'standards', 'pass', 10, 2.0),
        createMockScannerResult('seo_basic', 'seo', 'warn', 6, 1.5),
        createMockScannerResult('json_ld', 'structured_data', 'fail', 0, 2.5)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      expect(result.auditId).toBe('audit-123');
      expect(result.siteUrl).toBe('https://example.com');
      expect(result.pages).toHaveLength(1);
      expect(result.categoryScores).toHaveLength(3);
      expect(result.summary.totalIndicators).toBe(3);
    });

    it('should aggregate multiple page results', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('llms_txt', 'standards', 'pass', 10),
        createMockScannerResult('seo_basic', 'seo', 'pass', 8)
      ]);

      pageResults.set('https://example.com/about', [
        createMockScannerResult('seo_basic', 'seo', 'warn', 5),
        createMockScannerResult('json_ld', 'structured_data', 'pass', 9)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      expect(result.pages).toHaveLength(2);
      expect(result.summary.totalIndicators).toBe(4);
      
      const homePage = result.pages.find(p => p.url === 'https://example.com');
      const aboutPage = result.pages.find(p => p.url === 'https://example.com/about');
      
      expect(homePage?.indicators).toHaveLength(2);
      expect(aboutPage?.indicators).toHaveLength(2);
    });
  });

  describe('Page-level scoring', () => {
    it('should calculate page scores correctly', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('test1', 'standards', 'pass', 10, 1.0),
        createMockScannerResult('test2', 'seo', 'pass', 8, 1.0),
        createMockScannerResult('test3', 'structured_data', 'warn', 5, 1.0)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());
      const page = result.pages[0];

      // Average of 10, 8, 5 = 7.67 (rounded to 7.7)
      expect(page.pageScore).toBeCloseTo(7.7, 1);
    });

    it('should handle weighted page scores', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('high_weight', 'standards', 'pass', 10, 3.0),
        createMockScannerResult('low_weight', 'seo', 'fail', 0, 1.0)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());
      const page = result.pages[0];

      // (10*3 + 0*1) / (3+1) = 30/4 = 7.5
      expect(page.pageScore).toBe(7.5);
    });

    it('should handle pages with no results', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', []);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());
      const page = result.pages[0];

      expect(page.pageScore).toBe(0);
      expect(page.indicators).toHaveLength(0);
    });
  });

  describe('Site-level scoring', () => {
    it('should calculate overall site score as average of pages', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      // Page 1: score 8
      pageResults.set('https://example.com', [
        createMockScannerResult('test1', 'standards', 'pass', 8)
      ]);

      // Page 2: score 6
      pageResults.set('https://example.com/about', [
        createMockScannerResult('test2', 'seo', 'warn', 6)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      // (8 + 6) / 2 = 7
      expect(result.siteScore.overall).toBe(7);
    });

    it('should calculate weighted site score with category priorities', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('standards', 'standards', 'pass', 10, 1.0), // weight 3.0 * 1.0
        createMockScannerResult('seo', 'seo', 'pass', 8, 1.0), // weight 2.0 * 1.0
        createMockScannerResult('structured_data', 'structured_data', 'warn', 6, 1.0) // weight 2.5 * 1.0
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      // (10*3.0 + 8*2.0 + 6*2.5) / (3.0 + 2.0 + 2.5) = (30 + 16 + 15) / 7.5 = 61/7.5 = 8.13
      expect(result.siteScore.weighted).toBeCloseTo(8.1, 1);
    });

    it('should calculate category breakdown', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('standards1', 'standards', 'pass', 10),
        createMockScannerResult('standards2', 'standards', 'warn', 6),
        createMockScannerResult('seo1', 'seo', 'pass', 8),
        createMockScannerResult('structured1', 'structured_data', 'fail', 0)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      expect(result.siteScore.breakdown.standards).toBe(8); // (10+6)/2
      expect(result.siteScore.breakdown.seo).toBe(8);
      expect(result.siteScore.breakdown.structured_data).toBe(0);
      expect(result.siteScore.breakdown.accessibility).toBe(0); // No indicators
    });
  });

  describe('Category scoring', () => {
    it('should group indicators by category', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('std1', 'standards', 'pass', 10),
        createMockScannerResult('std2', 'standards', 'warn', 6),
        createMockScannerResult('seo1', 'seo', 'pass', 8)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      const standardsCategory = result.categoryScores.find(c => c.category === 'standards');
      const seoCategory = result.categoryScores.find(c => c.category === 'seo');

      expect(standardsCategory?.indicatorCount).toBe(2);
      expect(standardsCategory?.score).toBe(8); // (10+6)/2
      expect(seoCategory?.indicatorCount).toBe(1);
      expect(seoCategory?.score).toBe(8);
    });

    it('should count indicators by status', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('pass1', 'standards', 'pass', 10),
        createMockScannerResult('pass2', 'standards', 'pass', 9),
        createMockScannerResult('warn1', 'standards', 'warn', 5),
        createMockScannerResult('fail1', 'standards', 'fail', 0)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());
      const category = result.categoryScores.find(c => c.category === 'standards');

      expect(category?.passedCount).toBe(2);
      expect(category?.warningCount).toBe(1);
      expect(category?.failedCount).toBe(1);
    });

    it('should sort categories by weight', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('std', 'standards', 'pass', 10), // weight 3.0
        createMockScannerResult('seo', 'seo', 'pass', 8), // weight 2.0
        createMockScannerResult('struct', 'structured_data', 'pass', 9) // weight 2.5
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      // Should be sorted by weight: standards (3.0), structured_data (2.5), seo (2.0)
      expect(result.categoryScores[0].category).toBe('standards');
      expect(result.categoryScores[1].category).toBe('structured_data');
      expect(result.categoryScores[2].category).toBe('seo');
    });
  });

  describe('Summary generation', () => {
    it('should generate correct summary statistics', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('pass1', 'standards', 'pass', 10, 1.0),
        createMockScannerResult('pass2', 'seo', 'pass', 8, 1.0),
        createMockScannerResult('warn1', 'seo', 'warn', 5, 1.5),
        createMockScannerResult('fail1', 'structured_data', 'fail', 0, 2.0),
        createMockScannerResult('fail2', 'standards', 'fail', 0, 1.0)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      expect(result.summary.totalIndicators).toBe(5);
      expect(result.summary.passedIndicators).toBe(2);
      expect(result.summary.warningIndicators).toBe(1);
      expect(result.summary.failedIndicators).toBe(2);
    });

    it('should identify critical issues (high-weight failures)', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('critical_fail', 'standards', 'fail', 0, 2.5),
        createMockScannerResult('minor_fail', 'seo', 'fail', 0, 1.0)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      expect(result.summary.criticalIssues).toHaveLength(1);
      expect(result.summary.criticalIssues[0].indicatorName).toBe('critical_fail');
      expect(result.summary.criticalIssues[0].severity).toBe('critical');
      expect(result.summary.criticalIssues[0].message).toBe('critical_fail fail');
    });

    it('should collect top recommendations', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      pageResults.set('https://example.com', [
        createMockScannerResult('high_weight_fail', 'standards', 'fail', 0, 3.0),
        createMockScannerResult('medium_weight_warn', 'seo', 'warn', 5, 2.0),
        createMockScannerResult('low_weight_fail', 'structured_data', 'fail', 0, 1.0)
      ]);

      // Add recommendations to the results
      pageResults.get('https://example.com')![0].recommendation = 'Fix high priority issue';
      pageResults.get('https://example.com')![1].recommendation = 'Fix medium priority issue';
      pageResults.get('https://example.com')![2].recommendation = 'Fix low priority issue';

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      expect(result.summary.topRecommendations).toHaveLength(3);
      expect(result.summary.topRecommendations[0].indicatorName).toBe('high_weight_fail');
      expect(result.summary.topRecommendations[0].recommendation).toBe('Fix high priority issue');
      expect(result.summary.topRecommendations[0].priority).toBe('high');
    });
  });

  describe('AI readiness determination', () => {
    it('should classify as excellent for high scores', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', [
        createMockScannerResult('perfect', 'standards', 'pass', 10)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());
      expect(result.aiReadiness).toBe('excellent');
    });

    it('should classify as good for decent scores', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', [
        createMockScannerResult('good', 'standards', 'pass', 8)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());
      expect(result.aiReadiness).toBe('good');
    });

    it('should classify as needs improvement for medium scores', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', [
        createMockScannerResult('medium', 'standards', 'warn', 6)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());
      expect(result.aiReadiness).toBe('needs_improvement');
    });

    it('should classify as poor for low scores', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', [
        createMockScannerResult('poor', 'standards', 'fail', 2)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());
      expect(result.aiReadiness).toBe('poor');
    });
  });

  describe('Access intent determination', () => {
    it('should determine access intent from robots scanner', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      const robotsResult = createMockScannerResult('robots_txt', 'standards', 'pass', 8);
      robotsResult.details = { accessIntent: 'partial' };
      
      pageResults.set('https://example.com', [robotsResult]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());
      expect(result.accessIntent).toBe('partial');
    });

    it('should default to allow when no robots data', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', [
        createMockScannerResult('other', 'seo', 'pass', 8)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());
      expect(result.accessIntent).toBe('allow'); // Default
    });
  });

  describe('Edge cases', () => {
    it('should handle empty results', () => {
      const pageResults = new Map<string, ScannerResult[]>();

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      expect(result.pages).toHaveLength(0);
      expect(result.siteScore.overall).toBe(0);
      expect(result.categoryScores).toHaveLength(0);
      expect(result.summary.totalIndicators).toBe(0);
    });

    it('should handle indicators without scores', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      const resultWithoutScore: ScannerResult = {
        indicatorName: 'no_score',
        category: 'standards',
        status: 'pass',
        weight: 1.0
        // No score property
      };
      
      pageResults.set('https://example.com', [resultWithoutScore]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      // Should use default score based on status
      expect(result.pages[0].pageScore).toBe(10); // Default for 'pass'
    });

    it('should handle indicators without weights', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      
      const resultWithoutWeight: ScannerResult = {
        indicatorName: 'no_weight',
        category: 'standards',
        status: 'pass',
        score: 8
        // No weight property
      };
      
      pageResults.set('https://example.com', [resultWithoutWeight]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      expect(result.pages[0].pageScore).toBe(8);
    });
  });

  describe('Enhanced Response Structure', () => {
    it('should include audit metadata', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', [
        createMockScannerResult('llms_txt', 'standards', 'pass', 10, 2.0)
      ]);

      const scanStarted = new Date('2024-01-01T00:00:00Z');
      const scanCompleted = new Date('2024-01-01T00:00:05Z');
      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'full', scanStarted, scanCompleted);

      expect(result.auditType).toBe('full');
      expect(result.scanMetadata).toBeDefined();
      expect(result.scanMetadata.scanStarted).toEqual(scanStarted);
      expect(result.scanMetadata.scanCompleted).toEqual(scanCompleted);
      expect(result.scanMetadata.version).toBe('2.0');
      expect(result.scanMetadata.pagesCrawled).toBe(1);
      expect(result.scanMetadata.indicatorsChecked).toBe(1);
    });

    it('should provide AI readiness details', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', [
        createMockScannerResult('llms_txt', 'standards', 'pass', 10, 2.0),
        createMockScannerResult('json_ld', 'structured_data', 'pass', 8, 2.0),
        createMockScannerResult('seo_basic', 'seo', 'pass', 9, 1.5)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      expect(result.aiReadinessDetails).toBeDefined();
      expect(result.aiReadinessDetails.score).toBeGreaterThan(0);
      expect(result.aiReadinessDetails.maxScore).toBe(10);
      expect(result.aiReadinessDetails.factors).toBeDefined();
      expect(result.aiReadinessDetails.factors.hasLlmsTxt).toBe(true);
      expect(result.aiReadinessDetails.factors.hasStructuredData).toBe(true);
      expect(result.aiReadinessDetails.factors.hasSeoOptimization).toBe(true);
    });

    it('should provide access intent details', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', [
        createMockScannerResult('robots_txt', 'seo', 'pass', 10, 2.0)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      expect(result.accessIntentDetails).toBeDefined();
      expect(result.accessIntentDetails.intent).toBe('allow');
      expect(result.accessIntentDetails.sources).toBeDefined();
      expect(result.accessIntentDetails.allowedAgents).toBeDefined();
    });

    it('should provide enhanced category scores with insights', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', [
        createMockScannerResult('llms_txt', 'standards', 'pass', 10, 2.0),
        createMockScannerResult('robots_txt', 'seo', 'warn', 6, 1.5)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      expect(result.categoryScores).toHaveLength(2);
      
      const standardsCategory = result.categoryScores.find(c => c.category === 'standards');
      expect(standardsCategory).toBeDefined();
      expect(standardsCategory!.displayName).toBe('AI Standards');
      expect(standardsCategory!.description).toBeDefined();
      expect(standardsCategory!.maxScore).toBe(10);
      expect(standardsCategory!.categoryInsights).toBeDefined();
      expect(standardsCategory!.categoryInsights.keyStrengths).toBeDefined();
    });

    it('should provide enhanced page indicators', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', [
        createMockScannerResult('llms_txt', 'standards', 'pass', 10, 2.0),
        createMockScannerResult('seo_basic', 'seo', 'fail', 0, 1.5)
      ]);

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      expect(result.pages).toHaveLength(1);
      const page = result.pages[0];
      
      expect(page.indicators).toHaveLength(2);
      
      const llmsIndicator = page.indicators.find(i => i.name === 'llms_txt');
      expect(llmsIndicator).toBeDefined();
      expect(llmsIndicator!.displayName).toBe('LLMS.txt File');
      expect(llmsIndicator!.description).toBeDefined();
      expect(llmsIndicator!.maxScore).toBe(10);
      expect(llmsIndicator!.details).toBeDefined();
      expect(llmsIndicator!.scannedAt).toBeDefined();
    });

    it('should provide actionable items in summary', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', [
        createMockScannerResult('seo_basic', 'seo', 'fail', 0, 1.0), // Easy fix
        createMockScannerResult('json_ld', 'structured_data', 'fail', 0, 2.0) // Hard fix
      ]);

      pageResults.get('https://example.com')![0].recommendation = 'Add page title';
      pageResults.get('https://example.com')![1].recommendation = 'Implement structured data';

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      expect(result.summary.quickWins).toBeDefined();
      expect(result.summary.strategicImprovements).toBeDefined();
      expect(result.summary.completionPercentage).toBeDefined();
      expect(result.summary.aiReadinessPercentage).toBeDefined();
      expect(result.summary.complianceLevel).toBeDefined();
    });

    it('should provide prioritized issues and recommendations', () => {
      const pageResults = new Map<string, ScannerResult[]>();
      pageResults.set('https://example.com', [
        createMockScannerResult('critical_fail', 'standards', 'fail', 0, 3.0),
        createMockScannerResult('medium_warn', 'seo', 'warn', 5, 2.0)
      ]);

      pageResults.get('https://example.com')![0].recommendation = 'Fix critical issue';
      pageResults.get('https://example.com')![1].recommendation = 'Address warning';

      const result = aggregator.aggregate('audit-123', 'https://example.com', pageResults, 'quick', new Date(), new Date());

      expect(result.pages[0].issues).toBeDefined();
      expect(result.pages[0].recommendations).toBeDefined();
      
      const criticalIssue = result.pages[0].issues.find(i => i.severity === 'critical');
      expect(criticalIssue).toBeDefined();
      expect(criticalIssue!.actionable).toBeDefined();
      
      const highPriorityRec = result.pages[0].recommendations.find(r => r.priority === 'high');
      expect(highPriorityRec).toBeDefined();
      expect(highPriorityRec!.estimatedImpact).toBeDefined();
      expect(highPriorityRec!.difficulty).toBeDefined();
    });
  });
});