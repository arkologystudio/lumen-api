import { ScannerResult, IndicatorCategory } from './scanners/base';

export interface AggregatedResult {
  auditId: string;
  siteUrl: string;
  pages: PageAggregation[];
  siteScore: SiteScore;
  categoryScores: CategoryScore[];
  summary: AuditSummary;
  aiReadiness: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  accessIntent: 'allow' | 'partial' | 'block';
}

export interface PageAggregation {
  pageId?: string;
  url: string;
  indicators: ScannerResult[];
  pageScore: number;
  categoryScores: CategoryScore[];
  issues: string[];
  recommendations: string[];
}

export interface SiteScore {
  overall: number;
  weighted: number;
  breakdown: {
    standards: number;
    seo: number;
    structured_data: number;
    accessibility: number;
    performance: number;
    security: number;
  };
}

export interface CategoryScore {
  category: IndicatorCategory;
  score: number;
  weight: number;
  indicatorCount: number;
  passedCount: number;
  warningCount: number;
  failedCount: number;
}

export interface AuditSummary {
  totalIndicators: number;
  passedIndicators: number;
  warningIndicators: number;
  failedIndicators: number;
  criticalIssues: string[];
  topRecommendations: string[];
}

export class DiagnosticAggregator {
  
  /**
   * Aggregates scanner results into a comprehensive diagnostic report
   */
  aggregate(auditId: string, siteUrl: string, pageResults: Map<string, ScannerResult[]>): AggregatedResult {
    const pages: PageAggregation[] = [];
    let allIndicators: ScannerResult[] = [];
    
    // Process each page
    for (const [pageUrl, indicators] of pageResults.entries()) {
      const pageAggregation = this.aggregatePage(pageUrl, indicators);
      pages.push(pageAggregation);
      allIndicators.push(...indicators);
    }
    
    // Calculate site-level scores
    const siteScore = this.calculateSiteScore(pages, allIndicators);
    const categoryScores = this.calculateCategoryScores(allIndicators);
    const summary = this.generateSummary(allIndicators);
    const aiReadiness = this.determineAiReadiness(siteScore.overall);
    const accessIntent = this.determineAccessIntent(allIndicators);
    
    return {
      auditId,
      siteUrl,
      pages,
      siteScore,
      categoryScores,
      summary,
      aiReadiness,
      accessIntent
    };
  }
  
  private aggregatePage(url: string, indicators: ScannerResult[]): PageAggregation {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Collect issues and recommendations
    for (const indicator of indicators) {
      if (indicator.status === 'fail' || indicator.status === 'warn') {
        if (indicator.message) {
          issues.push(`${indicator.indicatorName}: ${indicator.message}`);
        }
        if (indicator.recommendation) {
          recommendations.push(indicator.recommendation);
        }
      }
    }
    
    const pageScore = this.calculatePageScore(indicators);
    const categoryScores = this.calculateCategoryScores(indicators);
    
    return {
      url,
      indicators,
      pageScore,
      categoryScores,
      issues: issues.slice(0, 10), // Limit to top 10 issues
      recommendations: recommendations.slice(0, 5) // Limit to top 5 recommendations
    };
  }
  
  private calculatePageScore(indicators: ScannerResult[]): number {
    if (indicators.length === 0) return 0;
    
    let totalWeightedScore = 0;
    let totalWeight = 0;
    
    for (const indicator of indicators) {
      const weight = indicator.weight || 1;
      const score = indicator.score || this.getDefaultScore(indicator.status);
      
      totalWeightedScore += score * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 10) / 10 : 0;
  }
  
  private calculateSiteScore(pages: PageAggregation[], allIndicators: ScannerResult[]): SiteScore {
    // Calculate overall site score (weighted average of pages)
    const overall = pages.length > 0 
      ? pages.reduce((sum, page) => sum + page.pageScore, 0) / pages.length
      : 0;
    
    // Calculate weighted score (giving more weight to critical indicators)
    const weighted = this.calculateWeightedScore(allIndicators);
    
    // Calculate category breakdown
    const breakdown = this.calculateCategoryBreakdown(allIndicators);
    
    return {
      overall: Math.round(overall * 10) / 10,
      weighted: Math.round(weighted * 10) / 10,
      breakdown
    };
  }
  
  private calculateWeightedScore(indicators: ScannerResult[]): number {
    const categoryWeights: Record<IndicatorCategory, number> = {
      standards: 3.0,      // AI standards are most important
      seo: 2.0,           // SEO is important for discovery
      structured_data: 2.5, // Structured data helps AI understanding
      accessibility: 1.5,
      performance: 1.5,
      security: 1.0
    };
    
    let totalWeightedScore = 0;
    let totalWeight = 0;
    
    for (const indicator of indicators) {
      const categoryWeight = categoryWeights[indicator.category] || 1;
      const indicatorWeight = indicator.weight || 1;
      const score = indicator.score || this.getDefaultScore(indicator.status);
      
      const finalWeight = categoryWeight * indicatorWeight;
      totalWeightedScore += score * finalWeight;
      totalWeight += finalWeight;
    }
    
    return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  }
  
  private calculateCategoryScores(indicators: ScannerResult[]): CategoryScore[] {
    const categoryMap = new Map<IndicatorCategory, ScannerResult[]>();
    
    // Group indicators by category
    for (const indicator of indicators) {
      if (!categoryMap.has(indicator.category)) {
        categoryMap.set(indicator.category, []);
      }
      categoryMap.get(indicator.category)!.push(indicator);
    }
    
    const categoryScores: CategoryScore[] = [];
    
    for (const [category, categoryIndicators] of categoryMap.entries()) {
      const score = this.calculatePageScore(categoryIndicators);
      const weight = this.getCategoryWeight(category);
      
      const passedCount = categoryIndicators.filter(i => i.status === 'pass').length;
      const warningCount = categoryIndicators.filter(i => i.status === 'warn').length;
      const failedCount = categoryIndicators.filter(i => i.status === 'fail').length;
      
      categoryScores.push({
        category,
        score,
        weight,
        indicatorCount: categoryIndicators.length,
        passedCount,
        warningCount,
        failedCount
      });
    }
    
    return categoryScores.sort((a, b) => b.weight - a.weight);
  }
  
  private calculateCategoryBreakdown(indicators: ScannerResult[]): SiteScore['breakdown'] {
    const categories: IndicatorCategory[] = ['standards', 'seo', 'structured_data', 'accessibility', 'performance', 'security'];
    const breakdown: any = {};
    
    for (const category of categories) {
      const categoryIndicators = indicators.filter(i => i.category === category);
      breakdown[category] = categoryIndicators.length > 0 
        ? this.calculatePageScore(categoryIndicators)
        : 0;
    }
    
    return breakdown as SiteScore['breakdown'];
  }
  
  private generateSummary(indicators: ScannerResult[]): AuditSummary {
    const totalIndicators = indicators.length;
    const passedIndicators = indicators.filter(i => i.status === 'pass').length;
    const warningIndicators = indicators.filter(i => i.status === 'warn').length;
    const failedIndicators = indicators.filter(i => i.status === 'fail').length;
    
    // Identify critical issues (failed indicators with high weight)
    const criticalIssues = indicators
      .filter(i => i.status === 'fail' && (i.weight || 1) >= 2)
      .map(i => i.message || `${i.indicatorName} failed`)
      .slice(0, 5);
    
    // Get top recommendations
    const topRecommendations = indicators
      .filter(i => i.recommendation && (i.status === 'fail' || i.status === 'warn'))
      .sort((a, b) => (b.weight || 1) - (a.weight || 1))
      .map(i => i.recommendation!)
      .slice(0, 5);
    
    return {
      totalIndicators,
      passedIndicators,
      warningIndicators,
      failedIndicators,
      criticalIssues,
      topRecommendations
    };
  }
  
  private determineAiReadiness(overallScore: number): 'excellent' | 'good' | 'needs_improvement' | 'poor' {
    if (overallScore >= 9) return 'excellent';
    if (overallScore >= 7) return 'good';
    if (overallScore >= 5) return 'needs_improvement';
    return 'poor';
  }
  
  private determineAccessIntent(indicators: ScannerResult[]): 'allow' | 'partial' | 'block' {
    // Check robots and AI-specific indicators
    const robotsIndicator = indicators.find(i => i.indicatorName === 'robots_txt');
    
    if (robotsIndicator?.details?.accessIntent) {
      return robotsIndicator.details.accessIntent as 'allow' | 'partial' | 'block';
    }
    
    // Default to allow if no explicit restrictions found
    return 'allow';
  }
  
  private getDefaultScore(status: 'pass' | 'warn' | 'fail' | 'not_applicable'): number {
    switch (status) {
      case 'pass': return 10;
      case 'warn': return 5;
      case 'fail': return 0;
      case 'not_applicable': return 0;
    }
  }
  
  private getCategoryWeight(category: IndicatorCategory): number {
    const weights: Record<IndicatorCategory, number> = {
      standards: 3.0,
      seo: 2.0,
      structured_data: 2.5,
      accessibility: 1.5,
      performance: 1.5,
      security: 1.0
    };
    
    return weights[category] || 1.0;
  }
}