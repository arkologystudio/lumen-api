
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

export interface StandardEvidence {
  // Basic evidence fields
  statusCode?: number;
  contentFound?: boolean;
  contentPreview?: string;
  validationScore?: number; // 0-100
  
  // Validation results
  validationIssues?: string[];
  warnings?: string[];
  missingFields?: string[];
  
  // Scanner-specific data
  specificData?: Record<string, any>;
  
  // AI readiness information
  aiReadinessFactors?: string[];
  aiOptimizationOpportunities?: string[];
  
  // Technical details
  checkedUrl?: string;
  responseTime?: number;
  error?: string;
  
  // Legacy compatibility - allow additional fields for gradual migration
  [key: string]: any;
}

export interface ScannerResult {
  indicatorName: string;
  category: IndicatorCategory;
  status: IndicatorStatus;
  score?: number;
  weight?: number;
  message: string;
  details: StandardEvidence;
  recommendation: string;
  checkedUrl?: string;
  found: boolean;
  isValid: boolean;
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
    const defaults: ScannerResult = {
      indicatorName: this.name,
      category: this.category,
      status: 'not_applicable',
      weight: this.weight,
      message: '',
      details: this.createStandardEvidence(),
      recommendation: '',
      found: false,
      isValid: false
    };
    
    return {
      ...defaults,
      ...partial,
      details: {
        ...defaults.details,
        ...partial.details
      }
    };
  }
  
  protected createStandardEvidence(evidence: Partial<StandardEvidence> = {}): StandardEvidence {
    return {
      contentFound: false,
      validationScore: 0,
      aiReadinessFactors: [],
      aiOptimizationOpportunities: [],
      ...evidence
    };
  }
  
  protected calculateScore(status: IndicatorStatus): number {
    switch (status) {
      case 'pass':
        return 1.0;
      case 'warn':
        return 0.5;
      case 'fail':
        return 0.0;
      case 'not_applicable':
        return 0.0;
    }
  }
}