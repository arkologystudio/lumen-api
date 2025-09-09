import {
  ScannerRegistry,
  BaseScanner,
  ScannerContext,
  ScannerResult,
  IndicatorCategory
} from '../../../../../src/services/diagnostics/scanners/base';

// Test scanner implementations
class TestScannerA extends BaseScanner {
  name = 'test_scanner_a';
  category: IndicatorCategory = 'standards';
  description = 'Test scanner A';
  weight = 1.0;

  async scan(context: ScannerContext): Promise<ScannerResult> {
    return this.createResult({
      status: 'pass',
      score: 10,
      message: 'Scanner A passed'
    });
  }
}

class TestScannerB extends BaseScanner {
  name = 'test_scanner_b';
  category: IndicatorCategory = 'seo';
  description = 'Test scanner B';
  weight = 2.0;

  async scan(context: ScannerContext): Promise<ScannerResult> {
    return this.createResult({
      status: 'warn',
      score: 6,
      message: 'Scanner B warning'
    });
  }
}

class ConditionalScanner extends BaseScanner {
  name = 'conditional_scanner';
  category: IndicatorCategory = 'standards';
  description = 'Conditional scanner';

  async scan(context: ScannerContext): Promise<ScannerResult> {
    return this.createResult({
      status: 'pass',
      score: 8,
      message: 'Conditional scanner passed'
    });
  }

  isApplicable(context: ScannerContext): boolean {
    return !!context.pageHtml;
  }
}

class ErrorScanner extends BaseScanner {
  name = 'error_scanner';
  category: IndicatorCategory = 'standards';
  description = 'Scanner that throws errors';

  async scan(context: ScannerContext): Promise<ScannerResult> {
    throw new Error('Scanner error');
  }
}

describe('ScannerRegistry', () => {
  let registry: ScannerRegistry;
  let scannerA: TestScannerA;
  let scannerB: TestScannerB;
  let conditionalScanner: ConditionalScanner;
  let errorScanner: ErrorScanner;
  let mockContext: ScannerContext;

  beforeEach(() => {
    // Get a fresh registry instance for each test
    registry = ScannerRegistry.getInstance();
    registry.clear(); // Clear any existing scanners
    
    scannerA = new TestScannerA();
    scannerB = new TestScannerB();
    conditionalScanner = new ConditionalScanner();
    errorScanner = new ErrorScanner();

    mockContext = {
      auditId: 'audit-123',
      siteUrl: 'https://example.com',
      pageHtml: '<html><head><title>Test</title></head><body>Content</body></html>'
    };
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ScannerRegistry.getInstance();
      const instance2 = ScannerRegistry.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Scanner registration', () => {
    it('should register scanners successfully', () => {
      registry.register(scannerA);
      registry.register(scannerB);

      expect(registry.getAllScanners()).toHaveLength(2);
      expect(registry.getScanner('test_scanner_a')).toBe(scannerA);
      expect(registry.getScanner('test_scanner_b')).toBe(scannerB);
    });

    it('should throw error when registering duplicate scanner names', () => {
      registry.register(scannerA);
      
      expect(() => {
        registry.register(scannerA);
      }).toThrow('Scanner test_scanner_a is already registered');
    });

    it('should allow registration after unregistering', () => {
      registry.register(scannerA);
      registry.unregister('test_scanner_a');
      
      expect(() => {
        registry.register(scannerA);
      }).not.toThrow();
    });
  });

  describe('Scanner retrieval', () => {
    beforeEach(() => {
      registry.register(scannerA);
      registry.register(scannerB);
    });

    it('should get scanner by name', () => {
      expect(registry.getScanner('test_scanner_a')).toBe(scannerA);
      expect(registry.getScanner('test_scanner_b')).toBe(scannerB);
      expect(registry.getScanner('nonexistent')).toBeUndefined();
    });

    it('should get all scanners', () => {
      const allScanners = registry.getAllScanners();
      
      expect(allScanners).toHaveLength(2);
      expect(allScanners).toContain(scannerA);
      expect(allScanners).toContain(scannerB);
    });

    it('should get scanners by category', () => {
      const standardsScanners = registry.getScannersByCategory('standards');
      const seoScanners = registry.getScannersByCategory('seo');
      
      expect(standardsScanners).toHaveLength(1);
      expect(standardsScanners[0]).toBe(scannerA);
      
      expect(seoScanners).toHaveLength(1);
      expect(seoScanners[0]).toBe(scannerB);
    });
  });

  describe('Scanner execution', () => {
    beforeEach(() => {
      registry.register(scannerA);
      registry.register(scannerB);
    });

    it('should run all scanners', async () => {
      const results = await registry.runAllScanners(mockContext);

      expect(results).toHaveLength(2);
      
      const resultA = results.find(r => r.indicatorName === 'test_scanner_a');
      const resultB = results.find(r => r.indicatorName === 'test_scanner_b');
      
      expect(resultA).toBeDefined();
      expect(resultA?.status).toBe('pass');
      expect(resultA?.score).toBe(10);
      
      expect(resultB).toBeDefined();
      expect(resultB?.status).toBe('warn');
      expect(resultB?.score).toBe(6);
    });

    it('should run scanners by category', async () => {
      const standardsResults = await registry.runScannersByCategory('standards', mockContext);
      const seoResults = await registry.runScannersByCategory('seo', mockContext);

      expect(standardsResults).toHaveLength(1);
      expect(standardsResults[0].indicatorName).toBe('test_scanner_a');
      
      expect(seoResults).toHaveLength(1);
      expect(seoResults[0].indicatorName).toBe('test_scanner_b');
    });

    it('should handle conditional scanners', async () => {
      registry.register(conditionalScanner);
      
      // With HTML - should run
      const resultsWithHtml = await registry.runAllScanners(mockContext);
      expect(resultsWithHtml).toHaveLength(3);
      
      // Without HTML - should not run conditional scanner
      const contextWithoutHtml = { ...mockContext, pageHtml: undefined };
      const resultsWithoutHtml = await registry.runAllScanners(contextWithoutHtml);
      
      expect(resultsWithoutHtml).toHaveLength(2); // Only scannerA and scannerB
      expect(resultsWithoutHtml.find(r => r.indicatorName === 'conditional_scanner')).toBeUndefined();
    });

    it('should handle scanner errors gracefully', async () => {
      registry.register(errorScanner);
      
      const results = await registry.runAllScanners(mockContext);
      
      expect(results).toHaveLength(3); // 2 successful + 1 error result
      
      const errorResult = results.find(r => r.indicatorName === 'error_scanner');
      expect(errorResult).toBeDefined();
      expect(errorResult?.status).toBe('fail');
      expect(errorResult?.score).toBe(0);
      expect(errorResult?.message).toContain('Scanner failed: Scanner error');
      expect(errorResult?.details?.metadata?.error).toBe('Scanner error');
    });
  });

  describe('Registry management', () => {
    it('should unregister scanners', () => {
      registry.register(scannerA);
      registry.register(scannerB);
      
      expect(registry.getAllScanners()).toHaveLength(2);
      
      registry.unregister('test_scanner_a');
      
      expect(registry.getAllScanners()).toHaveLength(1);
      expect(registry.getScanner('test_scanner_a')).toBeUndefined();
      expect(registry.getScanner('test_scanner_b')).toBe(scannerB);
    });

    it('should clear all scanners', () => {
      registry.register(scannerA);
      registry.register(scannerB);
      
      expect(registry.getAllScanners()).toHaveLength(2);
      
      registry.clear();
      
      expect(registry.getAllScanners()).toHaveLength(0);
      expect(registry.getScanner('test_scanner_a')).toBeUndefined();
      expect(registry.getScanner('test_scanner_b')).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty registry', async () => {
      const results = await registry.runAllScanners(mockContext);
      expect(results).toEqual([]);
    });

    it('should handle category with no scanners', async () => {
      registry.register(scannerA);
      
      const results = await registry.runScannersByCategory('nonexistent', mockContext);
      expect(results).toEqual([]);
    });

    it('should handle scanners without isApplicable method', async () => {
      registry.register(scannerA); // No custom isApplicable method
      
      const results = await registry.runAllScanners(mockContext);
      
      expect(results).toHaveLength(1);
      expect(results[0].indicatorName).toBe('test_scanner_a');
    });
  });
});