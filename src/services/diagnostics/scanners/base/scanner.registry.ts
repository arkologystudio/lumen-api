import { IScanner, ScannerContext, ScannerResult } from './scanner.interface';

export class ScannerRegistry {
  private static instance: ScannerRegistry;
  private scanners: Map<string, IScanner> = new Map();
  
  private constructor() {}
  
  static getInstance(): ScannerRegistry {
    if (!ScannerRegistry.instance) {
      ScannerRegistry.instance = new ScannerRegistry();
    }
    return ScannerRegistry.instance;
  }
  
  register(scanner: IScanner): void {
    if (this.scanners.has(scanner.name)) {
      throw new Error(`Scanner ${scanner.name} is already registered`);
    }
    this.scanners.set(scanner.name, scanner);
  }
  
  unregister(scannerName: string): void {
    this.scanners.delete(scannerName);
  }
  
  getScanner(name: string): IScanner | undefined {
    return this.scanners.get(name);
  }
  
  getAllScanners(): IScanner[] {
    return Array.from(this.scanners.values());
  }
  
  getScannersByCategory(category: string): IScanner[] {
    return this.getAllScanners().filter(scanner => scanner.category === category);
  }
  
  async runAllScanners(context: ScannerContext): Promise<ScannerResult[]> {
    const applicableScanners = this.getAllScanners().filter(scanner => 
      scanner.isApplicable ? scanner.isApplicable(context) : true
    );
    
    const results = await Promise.all(
      applicableScanners.map(scanner => 
        scanner.scan(context).catch(error => ({
          indicatorName: scanner.name,
          category: scanner.category,
          status: 'fail' as const,
          score: 0,
          message: `Scanner failed: ${error.message}`,
          details: { error: error.message }
        }))
      )
    );
    
    return results;
  }
  
  async runScannersByCategory(category: string, context: ScannerContext): Promise<ScannerResult[]> {
    const categoryScanners = this.getScannersByCategory(category);
    const applicableScanners = categoryScanners.filter(scanner => 
      scanner.isApplicable ? scanner.isApplicable(context) : true
    );
    
    const results = await Promise.all(
      applicableScanners.map(scanner => scanner.scan(context))
    );
    
    return results;
  }
  
  clear(): void {
    this.scanners.clear();
  }
}