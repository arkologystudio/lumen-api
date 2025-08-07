import { ScannerResult, IndicatorCategory } from './scanners/base';

// Enhanced individual indicator result for frontend consumption
export interface IndicatorResult {
  // Core identifier
  name: string;
  displayName: string;
  description: string;
  category: IndicatorCategory;
  
  // Status and scoring
  status: 'pass' | 'warn' | 'fail' | 'not_applicable';
  score: number;
  weight: number;
  maxScore: number; // Always 10 for normalization
  
  // User-facing messaging
  message: string;
  recommendation?: string;
  
  // Technical details
  checkedUrl?: string;
  found: boolean;
  isValid: boolean;
  
  // Rich details for UI
  details: IndicatorDetails;
  
  // Performance context
  scanDuration?: number;
  scannedAt: Date;
}

// Structured details interface
export interface IndicatorDetails {
  // Common fields
  statusCode?: number;
  error?: string;
  
  // Content analysis
  contentFound?: boolean;
  contentPreview?: string;
  
  // Validation results
  validationIssues?: string[];
  validationScore?: number;
  
  // Specific to indicator type
  specificData?: Record<string, any>;
  
  // AI-specific insights
  aiReadinessFactors?: string[];
  aiOptimizationOpportunities?: string[];
}

export interface IssueItem {
  indicatorName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  category: IndicatorCategory;
  actionable: boolean;
}

export interface RecommendationItem {
  indicatorName: string;
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
  estimatedImpact: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
  category: IndicatorCategory;
}

export interface PrioritizedIssue {
  indicatorName: string;
  category: IndicatorCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
}

export interface PrioritizedRecommendation {
  indicatorName: string;
  category: IndicatorCategory;
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
  expectedImprovement: string;
  estimatedEffort: string;
}

export interface ActionableItem {
  title: string;
  description: string;
  category: IndicatorCategory;
  estimatedImpact: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
  timeEstimate?: string;
}

export interface CategoryInsights {
  // Category-specific insights
  aiReadinessLevel?: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  keyStrengths: string[];
  keyWeaknesses: string[];
  quickWins: string[]; // Easy improvements
  strategicImprovements: string[]; // Longer-term improvements
}

export interface AiReadinessDetails {
  score: number;
  maxScore: number;
  factors: {
    hasLlmsTxt: boolean;
    hasAgentConfig: boolean;
    hasStructuredData: boolean;
    hasSeoOptimization: boolean;
    hasAccessibleContent: boolean;
  };
  missingElements: string[];
  strengthAreas: string[];
  improvementAreas: string[];
}

export interface AccessIntentDetails {
  intent: 'allow' | 'partial' | 'block';
  sources: string[]; // Which indicators determined this
  restrictions: string[];
  allowedAgents: string[];
  blockedAgents: string[];
}

export interface ScanMetadata {
  scanStarted: Date;
  scanCompleted: Date;
  duration: number;
  pagesCrawled: number;
  indicatorsChecked: number;
  version: string;
  limitations: string[]; // For free vs paid tiers
}

export interface AggregatedResult {
  auditId: string;
  siteUrl: string;
  auditType: 'full' | 'quick' | 'scheduled' | 'on_demand';
  
  // Enhanced page data
  pages: PageAggregation[];
  
  // Enhanced scoring
  siteScore: SiteScore;
  categoryScores: CategoryScore[];
  
  // Enhanced summary
  summary: AuditSummary;
  
  // AI-specific insights
  aiReadiness: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  aiReadinessDetails: AiReadinessDetails;
  accessIntent: 'allow' | 'partial' | 'block';
  accessIntentDetails: AccessIntentDetails;
  
  // Metadata
  scanMetadata: ScanMetadata;
}

export interface PageAggregation {
  pageId?: string;
  url: string;
  title?: string;
  
  // Individual indicator results
  indicators: IndicatorResult[];
  
  // Scores
  pageScore: number;
  categoryScores: CategoryScore[];
  
  // User-friendly summaries
  issues: IssueItem[];
  recommendations: RecommendationItem[];
  
  // Page metadata
  crawlMetadata?: {
    crawledAt: Date;
    responseTime: number;
    statusCode: number;
  };
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
  displayName: string; // User-friendly name
  description: string; // What this category means
  
  // Scoring
  score: number;
  maxScore: number;
  weight: number;
  
  // Indicator breakdown
  indicatorCount: number;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  
  // User guidance
  topIssues: string[];
  topRecommendations: string[];
  
  // Specific insights
  categoryInsights: CategoryInsights;
}

export interface AuditSummary {
  // Basic counts
  totalIndicators: number;
  passedIndicators: number;
  warningIndicators: number;
  failedIndicators: number;
  
  // Prioritized issues
  criticalIssues: PrioritizedIssue[];
  topRecommendations: PrioritizedRecommendation[];
  
  // Progress indicators
  completionPercentage: number;
  aiReadinessPercentage: number;
  
  // Actionable insights
  quickWins: ActionableItem[];
  strategicImprovements: ActionableItem[];
  
  // Compliance status
  complianceLevel: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  complianceGaps: string[];
}

export class DiagnosticAggregator {
  
  /**
   * Aggregates scanner results into a comprehensive diagnostic report
   */
  aggregate(
    auditId: string, 
    siteUrl: string, 
    pageResults: Map<string, ScannerResult[]>,
    auditType: 'full' | 'quick' | 'scheduled' | 'on_demand' = 'quick',
    scanStarted: Date = new Date(),
    scanCompleted: Date = new Date()
  ): AggregatedResult {
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
    const aiReadinessDetails = this.generateAiReadinessDetails(allIndicators, siteScore.overall);
    const accessIntent = this.determineAccessIntent(allIndicators);
    const accessIntentDetails = this.generateAccessIntentDetails(allIndicators);
    const scanMetadata = this.generateScanMetadata(scanStarted, scanCompleted, pages.length, allIndicators.length);
    
    return {
      auditId,
      siteUrl,
      auditType,
      pages,
      siteScore,
      categoryScores,
      summary,
      aiReadiness,
      aiReadinessDetails,
      accessIntent,
      accessIntentDetails,
      scanMetadata
    };
  }
  
  private aggregatePage(url: string, indicators: ScannerResult[]): PageAggregation {
    const enhancedIndicators = this.convertToIndicatorResults(indicators);
    const issues = this.generateIssueItems(indicators);
    const recommendations = this.generateRecommendationItems(indicators);
    
    const pageScore = this.calculatePageScore(indicators);
    const categoryScores = this.calculateCategoryScores(indicators);
    
    return {
      url,
      title: this.extractPageTitle(indicators),
      indicators: enhancedIndicators,
      pageScore,
      categoryScores,
      issues: issues.slice(0, 10), // Limit to top 10 issues
      recommendations: recommendations.slice(0, 5), // Limit to top 5 recommendations
      crawlMetadata: {
        crawledAt: new Date(),
        responseTime: 0, // TODO: Extract from crawler metadata
        statusCode: 200 // TODO: Extract from crawler metadata
      }
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
        displayName: this.getCategoryDisplayName(category),
        description: this.getCategoryDescription(category),
        score,
        maxScore: 10,
        weight,
        indicatorCount: categoryIndicators.length,
        passedCount,
        warningCount,
        failedCount,
        topIssues: this.getCategoryTopIssues(categoryIndicators),
        topRecommendations: this.getCategoryTopRecommendations(categoryIndicators),
        categoryInsights: this.generateCategoryInsights(category, categoryIndicators, score)
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
      .map(i => ({
        indicatorName: i.indicatorName,
        category: i.category,
        severity: this.determineSeverity(i.status, i.weight || 1),
        message: i.message || `${i.indicatorName} failed`,
        impact: this.determineImpact(i.category, i.weight || 1),
        effort: this.determineEffort(i.indicatorName)
      }))
      .slice(0, 5);
    
    // Get top recommendations
    const topRecommendations = indicators
      .filter(i => i.recommendation && (i.status === 'fail' || i.status === 'warn'))
      .sort((a, b) => (b.weight || 1) - (a.weight || 1))
      .map(i => ({
        indicatorName: i.indicatorName,
        category: i.category,
        priority: this.determinePriority(i.status, i.weight || 1),
        recommendation: i.recommendation!,
        expectedImprovement: this.determineExpectedImprovement(i.category),
        estimatedEffort: this.determineEffort(i.indicatorName)
      }))
      .slice(0, 5);
    
    const completionPercentage = totalIndicators > 0 ? Math.round((passedIndicators / totalIndicators) * 100) : 0;
    const aiReadinessPercentage = this.calculateAiReadinessPercentage(indicators);
    
    return {
      totalIndicators,
      passedIndicators,
      warningIndicators,
      failedIndicators,
      criticalIssues,
      topRecommendations,
      completionPercentage,
      aiReadinessPercentage,
      quickWins: this.generateQuickWins(indicators),
      strategicImprovements: this.generateStrategicImprovements(indicators),
      complianceLevel: this.determineComplianceLevel(completionPercentage),
      complianceGaps: this.identifyComplianceGaps(indicators)
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

  // New helper methods for enhanced functionality
  
  private convertToIndicatorResults(indicators: ScannerResult[]): IndicatorResult[] {
    return indicators.map(indicator => ({
      name: indicator.indicatorName,
      displayName: this.getIndicatorDisplayName(indicator.indicatorName),
      description: this.getIndicatorDescription(indicator.indicatorName),
      category: indicator.category,
      status: indicator.status,
      score: indicator.score || this.getDefaultScore(indicator.status),
      weight: indicator.weight || 1,
      maxScore: 10,
      message: indicator.message || this.generateDefaultMessage(indicator),
      recommendation: indicator.recommendation,
      checkedUrl: indicator.checkedUrl,
      found: indicator.found || false,
      isValid: indicator.isValid || false,
      details: this.enhanceIndicatorDetails(indicator),
      scannedAt: new Date()
    }));
  }

  private generateIssueItems(indicators: ScannerResult[]): IssueItem[] {
    return indicators
      .filter(i => i.status === 'fail' || i.status === 'warn')
      .map(i => ({
        indicatorName: i.indicatorName,
        severity: this.determineSeverity(i.status, i.weight || 1),
        message: i.message || `${i.indicatorName} needs attention`,
        category: i.category,
        actionable: !!i.recommendation
      }))
      .sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity));
  }

  private generateRecommendationItems(indicators: ScannerResult[]): RecommendationItem[] {
    return indicators
      .filter(i => i.recommendation && (i.status === 'fail' || i.status === 'warn'))
      .map(i => ({
        indicatorName: i.indicatorName,
        priority: this.determinePriority(i.status, i.weight || 1),
        recommendation: i.recommendation!,
        estimatedImpact: this.determineEstimatedImpact(i.category, i.weight || 1),
        difficulty: this.determineDifficulty(i.indicatorName),
        category: i.category
      }))
      .sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
  }

  private extractPageTitle(indicators: ScannerResult[]): string | undefined {
    const seoIndicator = indicators.find(i => i.indicatorName === 'seo_basic');
    return seoIndicator?.details?.title;
  }

  private getCategoryDisplayName(category: IndicatorCategory): string {
    const names: Record<IndicatorCategory, string> = {
      standards: 'AI Standards',
      seo: 'SEO Optimization',
      structured_data: 'Structured Data',
      accessibility: 'Accessibility',
      performance: 'Performance',
      security: 'Security'
    };
    return names[category] || category;
  }

  private getCategoryDescription(category: IndicatorCategory): string {
    const descriptions: Record<IndicatorCategory, string> = {
      standards: 'AI agent compatibility and instruction standards',
      seo: 'Search engine optimization for better discoverability',
      structured_data: 'Machine-readable data formats for AI understanding',
      accessibility: 'Content accessibility for all users and agents',
      performance: 'Site performance and loading optimization',
      security: 'Security measures and safe browsing indicators'
    };
    return descriptions[category] || `${category} related indicators`;
  }

  private getCategoryTopIssues(indicators: ScannerResult[]): string[] {
    return indicators
      .filter(i => i.status === 'fail')
      .map(i => i.message || `${i.indicatorName} failed`)
      .slice(0, 3);
  }

  private getCategoryTopRecommendations(indicators: ScannerResult[]): string[] {
    return indicators
      .filter(i => i.recommendation && (i.status === 'fail' || i.status === 'warn'))
      .map(i => i.recommendation!)
      .slice(0, 3);
  }

  private generateCategoryInsights(category: IndicatorCategory, indicators: ScannerResult[], score: number): CategoryInsights {
    return {
      aiReadinessLevel: this.determineAiReadiness(score),
      keyStrengths: this.identifyKeyStrengths(indicators),
      keyWeaknesses: this.identifyKeyWeaknesses(indicators),
      quickWins: this.identifyQuickWins(indicators),
      strategicImprovements: this.identifyStrategicImprovements(indicators)
    };
  }

  private generateAiReadinessDetails(indicators: ScannerResult[], overallScore: number): AiReadinessDetails {
    const hasLlmsTxt = indicators.some(i => i.indicatorName === 'llms_txt' && i.status === 'pass');
    const hasAgentConfig = indicators.some(i => (i.indicatorName === 'agent_json' || i.indicatorName === 'ai_agent_json') && i.status === 'pass');
    const hasStructuredData = indicators.some(i => i.indicatorName === 'json_ld' && i.status === 'pass');
    const hasSeoOptimization = indicators.some(i => i.indicatorName === 'seo_basic' && i.status === 'pass');
    const hasAccessibleContent = indicators.some(i => i.category === 'accessibility' && i.status === 'pass');

    const missingElements: string[] = [];
    if (!hasLlmsTxt) missingElements.push('llms.txt file');
    if (!hasAgentConfig) missingElements.push('Agent configuration');
    if (!hasStructuredData) missingElements.push('Structured data');
    if (!hasSeoOptimization) missingElements.push('SEO optimization');

    return {
      score: overallScore,
      maxScore: 10,
      factors: {
        hasLlmsTxt,
        hasAgentConfig,
        hasStructuredData,
        hasSeoOptimization,
        hasAccessibleContent
      },
      missingElements,
      strengthAreas: this.identifyStrengthAreas(indicators),
      improvementAreas: this.identifyImprovementAreas(indicators)
    };
  }

  private generateAccessIntentDetails(indicators: ScannerResult[]): AccessIntentDetails {
    const robotsIndicator = indicators.find(i => i.indicatorName === 'robots_txt');
    const intent = this.determineAccessIntent(indicators);
    
    return {
      intent,
      sources: robotsIndicator ? ['robots.txt'] : ['default policy'],
      restrictions: robotsIndicator?.details?.restrictions || [],
      allowedAgents: robotsIndicator?.details?.allowedAgents || ['*'],
      blockedAgents: robotsIndicator?.details?.blockedAgents || []
    };
  }

  private generateScanMetadata(scanStarted: Date, scanCompleted: Date, pagesCrawled: number, indicatorsChecked: number): ScanMetadata {
    return {
      scanStarted,
      scanCompleted,
      duration: scanCompleted.getTime() - scanStarted.getTime(),
      pagesCrawled,
      indicatorsChecked,
      version: '2.0',
      limitations: ['Free tier: limited to 3 pages', 'Free tier: basic scanning only']
    };
  }

  // Helper methods for various determinations

  private getIndicatorDisplayName(name: string): string {
    const displayNames: Record<string, string> = {
      'llms_txt': 'LLMS.txt File',
      'agent_json': 'Agent Configuration',
      'ai_agent_json': 'AI Agent Configuration',
      'robots_txt': 'Robots.txt',
      'canonical_urls': 'Canonical URLs',
      'sitemap_xml': 'XML Sitemap',
      'seo_basic': 'Basic SEO',
      'json_ld': 'JSON-LD Structured Data'
    };
    return displayNames[name] || name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private getIndicatorDescription(name: string): string {
    const descriptions: Record<string, string> = {
      'llms_txt': 'AI agent instruction file for crawling guidelines',
      'agent_json': 'Root-level agent configuration file',
      'ai_agent_json': 'Well-known directory agent configuration',
      'robots_txt': 'Robots.txt file and meta robots directives',
      'canonical_urls': 'Canonical URL implementation for content indexing',
      'sitemap_xml': 'XML sitemap detection and validation',
      'seo_basic': 'Basic SEO elements like title and meta description',
      'json_ld': 'JSON-LD structured data for enhanced understanding'
    };
    return descriptions[name] || `${name} indicator analysis`;
  }

  private generateDefaultMessage(indicator: ScannerResult): string {
    if (indicator.status === 'pass') {
      return `${indicator.indicatorName} is properly configured`;
    } else if (indicator.status === 'warn') {
      return `${indicator.indicatorName} has some issues that should be addressed`;
    } else if (indicator.status === 'fail') {
      return `${indicator.indicatorName} is missing or has critical issues`;
    }
    return `${indicator.indicatorName} is not applicable to this page`;
  }

  private enhanceIndicatorDetails(indicator: ScannerResult): IndicatorDetails {
    const enhanced: IndicatorDetails = {
      contentFound: indicator.found,
      specificData: indicator.details || {},
      ...indicator.details
    };

    // Add AI-specific insights based on indicator type
    if (indicator.category === 'standards') {
      enhanced.aiReadinessFactors = this.extractAiReadinessFactors(indicator);
      enhanced.aiOptimizationOpportunities = this.extractOptimizationOpportunities(indicator);
    }

    return enhanced;
  }

  private determineSeverity(status: string, weight: number): 'critical' | 'high' | 'medium' | 'low' {
    if (status === 'fail' && weight >= 2.5) return 'critical';
    if (status === 'fail' && weight >= 2.0) return 'high';
    if (status === 'fail' || (status === 'warn' && weight >= 2.0)) return 'medium';
    return 'low';
  }

  private determinePriority(status: string, weight: number): 'high' | 'medium' | 'low' {
    if (status === 'fail' && weight >= 2.0) return 'high';
    if (status === 'fail' || (status === 'warn' && weight >= 2.0)) return 'medium';
    return 'low';
  }

  private determineImpact(category: IndicatorCategory, weight: number): string {
    if (category === 'standards' && weight >= 2.0) {
      return 'High impact on AI agent compatibility and crawling';
    } else if (category === 'seo' && weight >= 2.0) {
      return 'High impact on search engine discoverability';
    } else if (weight >= 2.0) {
      return `High impact on ${category} optimization`;
    }
    return `Medium impact on ${category} performance`;
  }

  private determineEffort(indicatorName: string): 'low' | 'medium' | 'high' {
    const lowEffortIndicators = ['canonical_urls', 'seo_basic'];
    const highEffortIndicators = ['sitemap_xml', 'json_ld'];
    
    if (lowEffortIndicators.includes(indicatorName)) return 'low';
    if (highEffortIndicators.includes(indicatorName)) return 'high';
    return 'medium';
  }

  private determineExpectedImprovement(category: IndicatorCategory): string {
    const improvements: Record<IndicatorCategory, string> = {
      standards: 'Improved AI agent compatibility and crawling efficiency',
      seo: 'Better search engine ranking and discoverability',
      structured_data: 'Enhanced content understanding by search engines and AI',
      accessibility: 'Improved user experience and broader audience reach',
      performance: 'Faster loading times and better user experience',
      security: 'Enhanced security and trustworthiness'
    };
    return improvements[category] || 'General site optimization';
  }

  private determineEstimatedImpact(category: IndicatorCategory, weight: number): 'high' | 'medium' | 'low' {
    if (weight >= 2.5) return 'high';
    if (weight >= 1.5) return 'medium';
    return 'low';
  }

  private determineDifficulty(indicatorName: string): 'easy' | 'medium' | 'hard' {
    const easyIndicators = ['seo_basic', 'canonical_urls'];
    const hardIndicators = ['json_ld', 'sitemap_xml'];
    
    if (easyIndicators.includes(indicatorName)) return 'easy';
    if (hardIndicators.includes(indicatorName)) return 'hard';
    return 'medium';
  }

  private calculateAiReadinessPercentage(indicators: ScannerResult[]): number {
    const aiRelevantIndicators = indicators.filter(i => 
      i.category === 'standards' || i.category === 'structured_data'
    );
    const passedAiIndicators = aiRelevantIndicators.filter(i => i.status === 'pass').length;
    
    return aiRelevantIndicators.length > 0 
      ? Math.round((passedAiIndicators / aiRelevantIndicators.length) * 100)
      : 0;
  }

  private generateQuickWins(indicators: ScannerResult[]): ActionableItem[] {
    return indicators
      .filter(i => i.status === 'fail' && this.determineDifficulty(i.indicatorName) === 'easy')
      .slice(0, 3)
      .map(i => ({
        title: `Fix ${this.getIndicatorDisplayName(i.indicatorName)}`,
        description: i.recommendation || `Address issues with ${i.indicatorName}`,
        category: i.category,
        estimatedImpact: this.determineEstimatedImpact(i.category, i.weight || 1),
        difficulty: 'easy',
        timeEstimate: '15-30 minutes'
      }));
  }

  private generateStrategicImprovements(indicators: ScannerResult[]): ActionableItem[] {
    return indicators
      .filter(i => i.status === 'fail' && this.determineDifficulty(i.indicatorName) === 'hard')
      .slice(0, 3)
      .map(i => ({
        title: `Implement ${this.getIndicatorDisplayName(i.indicatorName)}`,
        description: i.recommendation || `Comprehensive implementation of ${i.indicatorName}`,
        category: i.category,
        estimatedImpact: this.determineEstimatedImpact(i.category, i.weight || 1),
        difficulty: 'hard',
        timeEstimate: '2-4 hours'
      }));
  }

  private determineComplianceLevel(completionPercentage: number): 'excellent' | 'good' | 'needs_improvement' | 'poor' {
    if (completionPercentage >= 90) return 'excellent';
    if (completionPercentage >= 75) return 'good';
    if (completionPercentage >= 50) return 'needs_improvement';
    return 'poor';
  }

  private identifyComplianceGaps(indicators: ScannerResult[]): string[] {
    return indicators
      .filter(i => i.status === 'fail')
      .map(i => `Missing or invalid ${this.getIndicatorDisplayName(i.indicatorName)}`)
      .slice(0, 5);
  }

  private getSeverityWeight(severity: string): number {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[severity as keyof typeof weights] || 1;
  }

  private getPriorityWeight(priority: string): number {
    const weights = { high: 3, medium: 2, low: 1 };
    return weights[priority as keyof typeof weights] || 1;
  }

  private identifyKeyStrengths(indicators: ScannerResult[]): string[] {
    return indicators
      .filter(i => i.status === 'pass')
      .map(i => this.getIndicatorDisplayName(i.indicatorName))
      .slice(0, 3);
  }

  private identifyKeyWeaknesses(indicators: ScannerResult[]): string[] {
    return indicators
      .filter(i => i.status === 'fail')
      .map(i => this.getIndicatorDisplayName(i.indicatorName))
      .slice(0, 3);
  }

  private identifyQuickWins(indicators: ScannerResult[]): string[] {
    return indicators
      .filter(i => i.status === 'fail' && this.determineDifficulty(i.indicatorName) === 'easy')
      .map(i => `Fix ${this.getIndicatorDisplayName(i.indicatorName)}`)
      .slice(0, 3);
  }

  private identifyStrategicImprovements(indicators: ScannerResult[]): string[] {
    return indicators
      .filter(i => i.status === 'fail' && this.determineDifficulty(i.indicatorName) === 'hard')
      .map(i => `Implement ${this.getIndicatorDisplayName(i.indicatorName)}`)
      .slice(0, 3);
  }

  private identifyStrengthAreas(indicators: ScannerResult[]): string[] {
    const categoryStrengths = new Map<IndicatorCategory, number>();
    
    indicators.forEach(i => {
      if (i.status === 'pass') {
        categoryStrengths.set(i.category, (categoryStrengths.get(i.category) || 0) + 1);
      }
    });

    return Array.from(categoryStrengths.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => this.getCategoryDisplayName(category));
  }

  private identifyImprovementAreas(indicators: ScannerResult[]): string[] {
    const categoryWeaknesses = new Map<IndicatorCategory, number>();
    
    indicators.forEach(i => {
      if (i.status === 'fail') {
        categoryWeaknesses.set(i.category, (categoryWeaknesses.get(i.category) || 0) + 1);
      }
    });

    return Array.from(categoryWeaknesses.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => this.getCategoryDisplayName(category));
  }

  private extractAiReadinessFactors(indicator: ScannerResult): string[] {
    const factors: string[] = [];
    
    if (indicator.indicatorName === 'llms_txt' && indicator.status === 'pass') {
      factors.push('Has AI crawling instructions');
    }
    if (indicator.indicatorName.includes('agent') && indicator.status === 'pass') {
      factors.push('Has agent configuration');
    }
    
    return factors;
  }

  private extractOptimizationOpportunities(indicator: ScannerResult): string[] {
    const opportunities: string[] = [];
    
    if (indicator.status === 'fail') {
      opportunities.push(`Implement ${this.getIndicatorDisplayName(indicator.indicatorName)}`);
    }
    if (indicator.status === 'warn' && indicator.recommendation) {
      opportunities.push(indicator.recommendation);
    }
    
    return opportunities;
  }
}