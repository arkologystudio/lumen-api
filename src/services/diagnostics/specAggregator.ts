import { ScannerResult, StandardEvidence } from './scanners/base';
import { SiteProfile, SiteProfileDetector } from './profileDetector';
import { ApplicabilityMatrix } from './applicabilityMatrix';

// Spec-compliant types
export type SpecApplicability = {
  status: 'required' | 'optional' | 'not_applicable';
  reason: string;
  included_in_category_math: boolean;
};

export type SpecIndicator = {
  name: string;
  score: number; // 0..1
  applicability: SpecApplicability;
  evidence: StandardEvidence;
};

export type SpecCategory = {
  score: number; // computed 0..1
  indicator_scores: Record<string, number>; // indicator name -> score
};

export type SpecWeights = {
  discovery: number;
  understanding: number;
  actions: number;
  trust: number;
};

export type LighthouseAIReport = {
  site: { 
    url: string; 
    scan_date: string; 
    category: string; // site profile
    profile_detection: {
      confidence: number;
      method: 'heuristic' | 'declared';
      signals: string[];
    };
  };
  categories: {
    discovery: SpecCategory;
    understanding: SpecCategory;
    actions: SpecCategory;
    trust: SpecCategory;
  };
  indicators: Record<string, SpecIndicator>; // indicator name -> full indicator data
  weights: SpecWeights;
  overall: { 
    raw_0_1: number; 
    score_0_100: number; 
  };
};

// Default weights from specification
export const DEFAULT_WEIGHTS: SpecWeights = {
  discovery: 0.30,
  understanding: 0.30,
  actions: 0.25,
  trust: 0.15,
};

export class SpecCompliantAggregator {
  private profileDetector: SiteProfileDetector;
  private applicabilityMatrix: ApplicabilityMatrix;
  
  constructor() {
    this.profileDetector = new SiteProfileDetector();
    this.applicabilityMatrix = new ApplicabilityMatrix();
  }
  
  /**
   * Aggregate scanner results into spec-compliant report
   */
  aggregate(
    siteUrl: string,
    pageResults: Map<string, ScannerResult[]>,
    declaredProfile?: SiteProfile,
    customWeights?: Partial<SpecWeights>
  ): LighthouseAIReport {
    // Collect all indicators and page URLs
    const allIndicators: ScannerResult[] = [];
    const pageUrls: string[] = [];
    
    for (const [pageUrl, indicators] of pageResults.entries()) {
      pageUrls.push(pageUrl);
      allIndicators.push(...indicators);
    }
    
    // Detect or use declared profile
    const profileResult = this.profileDetector.detectProfile(
      allIndicators,
      pageUrls,
      declaredProfile
    );
    
    // Map indicators to spec categories
    const categoryMapping = this.getCategoryMapping();
    const categories: LighthouseAIReport['categories'] = {
      discovery: { score: 0, indicator_scores: {} },
      understanding: { score: 0, indicator_scores: {} },
      actions: { score: 0, indicator_scores: {} },
      trust: { score: 0, indicator_scores: {} }
    };
    
    const indicators: Record<string, SpecIndicator> = {};
    
    // Process each indicator
    for (const indicator of allIndicators) {
      const specIndicator = this.convertToSpecIndicator(
        indicator, 
        profileResult.profile
      );
      
      // Store in indicators object
      indicators[specIndicator.name] = specIndicator;
      
      // Add to appropriate categories based on mapping
      for (const [category, indicatorNames] of Object.entries(categoryMapping)) {
        if (this.indicatorBelongsToCategory(indicator.indicatorName, indicatorNames)) {
          categories[category as keyof typeof categories].indicator_scores[specIndicator.name] = specIndicator.score;
        }
      }
    }
    
    // Calculate category scores
    for (const category of Object.keys(categories) as Array<keyof typeof categories>) {
      categories[category].score = this.calculateCategoryScoreFromScores(categories[category].indicator_scores, indicators);
    }
    
    // Merge weights with defaults
    const weights = { ...DEFAULT_WEIGHTS, ...(customWeights || {}) };
    
    // Calculate overall score
    const overall = this.calculateOverallScore(categories, weights);
    
    return {
      site: {
        url: siteUrl,
        scan_date: new Date().toISOString().split('T')[0],
        category: profileResult.profile,
        profile_detection: {
          confidence: profileResult.confidence,
          method: profileResult.method,
          signals: profileResult.signals
        }
      },
      categories,
      indicators,
      weights,
      overall
    };
  }
  
  private convertToSpecIndicator(
    indicator: ScannerResult,
    profile: SiteProfile
  ): SpecIndicator {
    const applicability = this.applicabilityMatrix.getApplicability(
      indicator.indicatorName,
      profile
    );
    
    // Use spec-compliant scoring (0-1 range)
    let score = 0.0;
    if (indicator.score !== undefined) {
      // If score is already in 0-1 range, use it
      score = indicator.score <= 1 ? indicator.score : indicator.score / 10;
    } else {
      // Calculate from status
      switch (indicator.status) {
        case 'pass': score = 1.0; break;
        case 'warn': score = 0.5; break;
        case 'fail': score = 0.0; break;
        case 'not_applicable': score = 0.0; break;
      }
    }
    
    return {
      name: indicator.indicatorName,
      score,
      applicability: {
        status: applicability.status,
        reason: applicability.reason,
        included_in_category_math: applicability.included_in_category_math
      },
      evidence: indicator.details
    };
  }
  
  private calculateCategoryScoreFromScores(
    indicatorScores: Record<string, number>, 
    allIndicators: Record<string, SpecIndicator>
  ): number {
    const includedScores: number[] = [];
    
    for (const [indicatorName, score] of Object.entries(indicatorScores)) {
      const indicator = allIndicators[indicatorName];
      if (indicator && indicator.applicability.included_in_category_math) {
        includedScores.push(score);
      }
    }
    
    if (includedScores.length === 0) {
      return 0;
    }
    
    const sum = includedScores.reduce((acc, score) => acc + score, 0);
    return sum / includedScores.length;
  }
  
  private calculateOverallScore(
    categories: LighthouseAIReport['categories'],
    weights: SpecWeights
  ): { raw_0_1: number; score_0_100: number } {
    const raw = 
      weights.discovery * categories.discovery.score +
      weights.understanding * categories.understanding.score +
      weights.actions * categories.actions.score +
      weights.trust * categories.trust.score;
    
    const score_0_100 = Math.round(100 * raw);
    
    return { raw_0_1: raw, score_0_100 };
  }
  
  private getCategoryMapping(): Record<string, string[]> {
    return {
      discovery: ['robots_txt', 'sitemap_xml', 'seo_basic'],
      understanding: ['json_ld', 'llms_txt', 'canonical_urls'],
      actions: ['mcp', 'agent_json'],
      trust: ['canonical_urls', 'robots_txt', 'seo_basic']
    };
  }
  
  private indicatorBelongsToCategory(indicatorName: string, categoryIndicators: string[]): boolean {
    // Handle both exact matches and variations (e.g., agent_json vs agents_json)
    const normalizedName = indicatorName.replace('agent_json', 'agents_json');
    return categoryIndicators.includes(indicatorName) || 
           categoryIndicators.includes(normalizedName);
  }
  
  /**
   * Helper functions from specification
   */
  mean(xs: number[]): number {
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  }
  
  categoryScore(indicators: SpecIndicator[]): number {
    const included = indicators.filter(i => i.applicability.included_in_category_math);
    return this.mean(included.map(i => i.score));
  }
}