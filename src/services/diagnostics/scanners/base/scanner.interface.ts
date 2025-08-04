
export type IndicatorStatus = 'pass' | 'warn' | 'fail' | 'not_applicable';

export type IndicatorCategory = 
  | 'standards'
  | 'seo'
  | 'structured_data'
  | 'accessibility'
  | 'performance'
  | 'security';

export interface ScannerContext {
  auditId: string;
  pageId?: string;
  siteUrl: string;
  pageUrl?: string;
  pageHtml?: string;
  pageMetadata?: PageMetadata;
  crawlerMetadata?: CrawlerMetadata;
}

export interface PageMetadata {
  title?: string;
  metaDescription?: string;
  ogTags?: Record<string, string>;
  statusCode?: number;
  loadTimeMs?: number;
  wordCount?: number;
}

export interface CrawlerMetadata {
  userAgent?: string;
  viewport?: { width: number; height: number };
  crawledAt?: Date;
}

export interface ScannerResult {
  indicatorName: string;
  category: IndicatorCategory;
  status: IndicatorStatus;
  score?: number;
  weight?: number;
  message?: string;
  details?: Record<string, any>;
  recommendation?: string;
  checkedUrl?: string;
  found?: boolean;
  isValid?: boolean;
  llmAnalysis?: LLMAnalysis;
}

export interface LLMAnalysis {
  score?: number;
  confidence?: number;
  analysis?: Record<string, any>;
  prompt?: string;
  model?: string;
}

export interface IScanner {
  name: string;
  category: IndicatorCategory;
  description: string;
  weight: number;
  
  scan(context: ScannerContext): Promise<ScannerResult>;
  
  isApplicable?(context: ScannerContext): boolean;
}

export abstract class BaseScanner implements IScanner {
  abstract name: string;
  abstract category: IndicatorCategory;
  abstract description: string;
  weight: number = 1.0;
  
  abstract scan(context: ScannerContext): Promise<ScannerResult>;
  
  isApplicable(context: ScannerContext): boolean {
    return true;
  }
  
  protected createResult(partial: Partial<ScannerResult>): ScannerResult {
    return {
      indicatorName: this.name,
      category: this.category,
      status: 'not_applicable',
      weight: this.weight,
      ...partial
    };
  }
  
  protected calculateScore(status: IndicatorStatus): number {
    switch (status) {
      case 'pass':
        return 10;
      case 'warn':
        return 5;
      case 'fail':
        return 0;
      case 'not_applicable':
        return 0;
    }
  }
}