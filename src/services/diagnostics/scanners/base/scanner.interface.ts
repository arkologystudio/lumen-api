
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

// Scanner-specific data type definitions
export interface SeoAnalysisData {
  title?: {
    exists: boolean;
    title?: string;
    length?: number;
    optimal: boolean;
    issue?: string;
  };
  metaDescription?: {
    exists: boolean;
    metaDescription?: string;
    length?: number;
    optimal: boolean;
    issue?: string;
  };
  headings?: {
    structure: string[];
    h1Count: number;
    hasH1: boolean;
    hierarchy: boolean;
    issue?: string;
  };
  openGraph?: {
    hasTitle: boolean;
    hasDescription: boolean;
    hasImage: boolean;
    hasUrl: boolean;
    hasType: boolean;
    score: number;
  };
  navigation?: {
    menuItems: string[];
    linkTexts: string[];
  };
}

export interface JsonLdAnalysisData {
  found: boolean;
  count: number;
  types: string[];
  schemas?: string[];
  hasOrganization: boolean;
  hasWebSite: boolean;
  hasWebPage: boolean;
  hasBreadcrumb: boolean;
  hasProduct: boolean;
  hasArticle: boolean;
  validationIssues: string[];
  aiRelevantTypes: string[];
}

export interface RobotsAnalysisData {
  accessIntent?: 'allow' | 'partial' | 'block';
  hasUserAgent?: boolean;
  hasAiDirectives?: boolean;
  rules?: Array<{
    userAgent: string;
    disallow: string[];
    allow: string[];
  }>;
  sitemaps?: string[];
  robotsTxt?: any;
  robotsMeta?: any;
  aiAgentRestrictions?: any[];
  sitemapReferences?: number;
}

export interface CanonicalAnalysisData {
  url?: string;
  isValid?: boolean;
  isSelfReferencing?: boolean;
  responseCode?: number;
  canonicalUrl?: string;
  pageUrl?: string;
  ogUrl?: string;
  isAbsolute?: boolean;
  matchesOgUrl?: boolean;
}

export interface AgentJsonAnalysisData {
  version?: string;
  schema?: Record<string, any>;
  endpoints?: Array<{
    path: string;
    method: string;
    description?: string;
  }>;
  capabilities?: string[] | number;
  content?: any; // Raw content found
  hasApi?: boolean;
  pageUrl?: string;
}

export interface McpAnalysisData {
  servers?: Array<{
    name: string;
    description?: string;
    version?: string;
  }>;
  tools?: Array<{
    name: string;
    description?: string;
  }>;
  prompts?: Array<{
    name: string;
    description?: string;
  }>;
  checkedUrl?: string;
  hasMcp?: boolean;
  mcpConfig?: any;
  actionCount?: number;
  authRequired?: boolean;
}

export interface SitemapAnalysisData {
  urls?: string[];
  urlCount?: number;
  isValid?: boolean;
  lastModified?: string;
  hasImages?: boolean;
  hasVideos?: boolean;
  checkedLocations?: string[];
  sitemapUrls?: string[];
  totalUrls?: number;
  validSitemaps?: number;
  hasLastmod?: boolean;
  hasChangefreq?: boolean;
  hasPriority?: boolean;
}

export interface LlmsTxtAnalysisData {
  sections?: Array<{
    title: string;
    content: string;
  }>;
  totalSections?: number;
  hasInstructions?: boolean;
  hasExamples?: boolean;
  checkedPaths?: string[];
  parsedContent?: any;
  expectedFormat?: string;
  sectionCount?: number;
  examples?: string[];
  detectedSections?: string[];
  contentLength?: number;
  hasTitle?: boolean;
  hasSummary?: boolean;
  linkCount?: number;
}

// Union type for all scanner-specific data
export type ScannerSpecificData = 
  | SeoAnalysisData
  | JsonLdAnalysisData 
  | RobotsAnalysisData
  | CanonicalAnalysisData
  | AgentJsonAnalysisData
  | McpAnalysisData
  | SitemapAnalysisData
  | LlmsTxtAnalysisData;

// Type guard functions
export const isSeoAnalysisData = (data: ScannerSpecificData): data is SeoAnalysisData => {
  return 'title' in data || 'metaDescription' in data || 'headings' in data || 'openGraph' in data || 'navigation' in data;
};

export const isJsonLdAnalysisData = (data: ScannerSpecificData): data is JsonLdAnalysisData => {
  return 'found' in data && 'count' in data && 'types' in data;
};

export const isRobotsAnalysisData = (data: ScannerSpecificData): data is RobotsAnalysisData => {
  return 'accessIntent' in data || 'hasUserAgent' in data || 'hasAiDirectives' in data;
};

export const isCanonicalAnalysisData = (data: ScannerSpecificData): data is CanonicalAnalysisData => {
  return 'url' in data || 'isValid' in data || 'isSelfReferencing' in data;
};

export const isAgentJsonAnalysisData = (data: ScannerSpecificData): data is AgentJsonAnalysisData => {
  return 'version' in data || 'schema' in data || 'endpoints' in data || 'capabilities' in data;
};

export const isMcpAnalysisData = (data: ScannerSpecificData): data is McpAnalysisData => {
  return 'servers' in data || 'tools' in data || 'prompts' in data || 'hasMcp' in data;
};

export const isSitemapAnalysisData = (data: ScannerSpecificData): data is SitemapAnalysisData => {
  return 'urls' in data || 'urlCount' in data || 'sitemapUrls' in data;
};

export const isLlmsTxtAnalysisData = (data: ScannerSpecificData): data is LlmsTxtAnalysisData => {
  return 'sections' in data || 'totalSections' in data || 'hasInstructions' in data || 'parsedContent' in data;
};

/** Validation findings with different severity levels */
export interface ValidationFindings {
  /** Critical validation errors that prevent proper functionality */
  errors?: string[];
  
  /** Non-critical warnings that should be addressed for optimization */
  warnings?: string[];
  
  /** Required fields or elements that were not found */
  missing?: string[];
}

/** Core evidence data from diagnostic scanning */
export interface StandardEvidence {
  // Content Discovery
  
  /** Whether the expected content/file was found during scanning */
  found?: boolean;
  
  /** HTTP status code returned when checking the resource (e.g., 200, 404, 500) */
  statusCode?: number;
  
  /** Preview of the content found, truncated for display purposes
   * @example "User-agent: *\nDisallow: /admin\nSitemap: https://..." */
  contentPreview?: string;
  
  // Validation Results
  
  /** Numeric score from 0-100 indicating validation quality */
  score?: number;
  
  /** Structured validation findings organized by severity */
  validation?: ValidationFindings;
  
  // Scanner-Specific Analysis
  
  /** Detailed analysis data specific to each scanner type */
  analysis?: ScannerSpecificData;
  
  // AI Optimization Insights
  
  /** Factors that enhance AI agent compatibility */
  aiFactors?: {
    /** Positive aspects that help AI understanding */
    strengths?: string[];
    /** Areas for improvement to enhance AI compatibility */
    opportunities?: string[];
  };
  
  // Technical Metadata
  
  /** Technical details about the scan execution */
  metadata?: {
    /** The specific URL that was checked during scanning */
    checkedUrl?: string;
    /** Time taken to complete the scan in milliseconds */
    responseTime?: number;
    /** Error message if the scan failed or encountered issues */
    error?: string;
    /** Generic reason field for simple cases */
    reason?: string;
  };
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
      found: false,
      score: 0,
      validation: {
        errors: [],
        warnings: [],
        missing: []
      },
      aiFactors: {
        strengths: [],
        opportunities: []
      },
      metadata: {},
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