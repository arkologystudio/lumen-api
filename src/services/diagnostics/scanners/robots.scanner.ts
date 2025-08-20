import { BaseScanner, ScannerContext, ScannerResult, IndicatorCategory, IndicatorStatus } from './base';
import { fetchUrl, buildUrl, parseRobotsTxt, extractRobotsMeta } from './base/scanner.utils';

export class RobotsScanner extends BaseScanner {
  name = 'robots_txt';
  category: IndicatorCategory = 'standards';
  description = 'Analyzes robots.txt and robots meta tags for AI agent access intent (not scored)';
  weight = 0; // Set to 0 to exclude from scoring calculations
  
  async scan(context: ScannerContext): Promise<ScannerResult> {
    const robotsTxtUrl = buildUrl(context.siteUrl, '/robots.txt');
    const robotsTxtResult = await fetchUrl(robotsTxtUrl);
    
    let robotsTxtAnalysis: any = null;
    let robotsMetaAnalysis: any = null;
    let combinedScore = 0;
    let status: IndicatorStatus = 'fail';
    let messages: string[] = [];
    
    // Analyze robots.txt
    if (robotsTxtResult.found) {
      robotsTxtAnalysis = this.analyzeRobotsTxt(robotsTxtResult.content || '');
      messages.push(robotsTxtAnalysis.message);
      combinedScore += robotsTxtAnalysis.score * 0.6; // 60% weight for robots.txt
    } else {
      messages.push('No robots.txt file found');
    }
    
    // Analyze robots meta tags if page HTML is available
    if (context.pageHtml) {
      robotsMetaAnalysis = this.analyzeRobotsMeta(context.pageHtml);
      messages.push(robotsMetaAnalysis.message);
      combinedScore += robotsMetaAnalysis.score * 0.4; // 40% weight for meta tags
    }
    
    // For access intent determination only - don't use traditional pass/warn/fail
    status = 'not_applicable'; // Use not_applicable to exclude from scoring
    
    const accessIntent = this.determineAccessIntent(robotsTxtAnalysis, robotsMetaAnalysis);
    
    return this.createResult({
      status,
      score: 0.0, // Always 0 to exclude from scoring
      message: `Access intent: ${accessIntent} - ${messages.join('; ')}`,
      details: {
        statusCode: robotsTxtResult.statusCode,
        contentFound: robotsTxtResult.found,
        contentPreview: robotsTxtResult.found ? 
          robotsTxtResult.content?.substring(0, 200) + (robotsTxtResult.content && robotsTxtResult.content.length > 200 ? '...' : '') 
          : null,
        validationScore: Math.round(combinedScore),
        specificData: {
          robotsTxt: robotsTxtAnalysis,
          robotsMeta: robotsMetaAnalysis,
          accessIntent,
          checkedUrl: robotsTxtUrl,
          aiAgentRestrictions: robotsTxtAnalysis?.aiUserAgents || [],
          sitemapReferences: robotsTxtAnalysis?.sitemapCount || 0,
          hasAiDirectives: robotsTxtAnalysis?.hasAiDirectives || false
        },
        aiReadinessFactors: this.generateAiReadinessFactors(robotsTxtAnalysis, robotsMetaAnalysis),
        aiOptimizationOpportunities: this.generateAiOptimizationOpportunities(robotsTxtAnalysis, robotsMetaAnalysis, accessIntent)
      },
      recommendation: this.generateRecommendation(robotsTxtAnalysis, robotsMetaAnalysis),
      checkedUrl: robotsTxtUrl,
      found: robotsTxtResult.found,
      isValid: true // Always valid since we're only determining access intent
    });
  }
  
  private analyzeRobotsTxt(content: string): any {
    const parsed = parseRobotsTxt(content);
    const analysis: any = {
      hasContent: content.trim().length > 0,
      userAgents: Object.keys(parsed.userAgents),
      hasSitemaps: parsed.sitemaps.length > 0,
      sitemapCount: parsed.sitemaps.length,
      hasAiDirectives: false,
      aiUserAgents: [],
      score: 0,
      message: ''
    };
    
    // Check for AI-specific user agents
    const aiAgents = ['GPTBot', 'ChatGPT-User', 'CCBot', 'anthropic-ai', 'Claude-Web'];
    for (const agent of aiAgents) {
      if (parsed.userAgents[agent]) {
        analysis.hasAiDirectives = true;
        analysis.aiUserAgents.push(agent);
      }
    }
    
    // Check for AI-related directives in general rules
    const generalRules = parsed.userAgents['*'] || {};
    if (generalRules.disallow?.some((path: string) => path.includes('noai'))) {
      analysis.hasAiDirectives = true;
    }
    
    // Calculate score (using 0-1 range)
    if (!analysis.hasContent) {
      analysis.score = 0.0;
      analysis.message = 'Empty robots.txt file';
    } else if (analysis.hasAiDirectives) {
      analysis.score = 1.0;
      analysis.message = 'robots.txt contains AI-specific directives';
    } else if (analysis.hasSitemaps) {
      analysis.score = 0.7;
      analysis.message = 'robots.txt found with sitemaps but no AI directives';
    } else {
      analysis.score = 0.5;
      analysis.message = 'Basic robots.txt found without AI considerations';
    }
    
    return analysis;
  }
  
  private analyzeRobotsMeta(html: string): any {
    const robots = extractRobotsMeta(html);
    const analysis: any = {
      hasRobotsMeta: false,
      directives: robots,
      hasAiDirectives: false,
      score: 0,
      message: ''
    };
    
    // Check if any robots directives exist
    const hasAnyDirective = Object.values(robots).some(v => v === true);
    analysis.hasRobotsMeta = hasAnyDirective;
    
    // Check for AI-specific directives
    if (robots.noai || robots.noimageai) {
      analysis.hasAiDirectives = true;
    }
    
    // Calculate score (using 0-1 range)
    if (analysis.hasAiDirectives) {
      analysis.score = 1.0;
      analysis.message = 'Page contains AI-specific robots meta tags';
    } else if (analysis.hasRobotsMeta) {
      analysis.score = 0.5;
      analysis.message = 'Page has robots meta tags but no AI directives';
    } else {
      analysis.score = 0.7;
      analysis.message = 'No restrictive robots meta tags found';
    }
    
    return analysis;
  }
  
  private determineAccessIntent(robotsTxt: any, robotsMeta: any): string {
    const hasRestrictiveAi = 
      robotsTxt?.aiUserAgents?.length > 0 ||
      robotsMeta?.directives?.noai ||
      robotsMeta?.directives?.noimageai;
    
    const hasAnyRestriction = 
      robotsTxt?.userAgents?.['*']?.disallow?.length > 0 ||
      robotsMeta?.directives?.noindex ||
      robotsMeta?.directives?.nofollow;
    
    if (hasRestrictiveAi) {
      return 'block';
    } else if (hasAnyRestriction) {
      return 'partial';
    } else {
      return 'allow';
    }
  }
  
  private generateRecommendation(robotsTxt: any, robotsMeta: any): string {
    const recommendations: string[] = [];
    
    if (!robotsTxt || !robotsTxt.hasContent) {
      recommendations.push('Create a robots.txt file to control crawler access');
    }
    
    if (!robotsTxt?.hasAiDirectives && !robotsMeta?.hasAiDirectives) {
      recommendations.push('Consider adding AI-specific directives (e.g., User-agent: GPTBot) to explicitly control AI crawler access');
    }
    
    if (!robotsTxt?.hasSitemaps) {
      recommendations.push('Add sitemap references to robots.txt for better discoverability');
    }
    
    return recommendations.length > 0 
      ? recommendations.join('. ')
      : 'Robots configuration is well-optimized for AI agents';
  }

  private generateAiReadinessFactors(robotsTxtAnalysis: any, robotsMetaAnalysis: any): string[] {
    const factors: string[] = [];
    
    if (robotsTxtAnalysis?.hasContent) {
      factors.push('Robots.txt file exists');
    }
    
    if (robotsTxtAnalysis?.hasSitemaps) {
      factors.push('Sitemap references found in robots.txt');
    }
    
    if (robotsTxtAnalysis?.hasAiDirectives) {
      factors.push('AI-specific directives configured');
    }
    
    if (robotsMetaAnalysis?.hasMetaRobots) {
      factors.push('Meta robots tags implemented');
    }
    
    return factors;
  }

  private generateAiOptimizationOpportunities(robotsTxtAnalysis: any, robotsMetaAnalysis: any, accessIntent: string): string[] {
    const opportunities: string[] = [];
    
    if (!robotsTxtAnalysis?.hasContent) {
      opportunities.push('Create robots.txt file to guide AI crawlers');
    }
    
    if (!robotsTxtAnalysis?.hasAiDirectives) {
      opportunities.push('Add AI-specific user-agent directives (GPTBot, Claude-Web, etc.)');
    }
    
    if (!robotsTxtAnalysis?.hasSitemaps) {
      opportunities.push('Add sitemap references to robots.txt for better discovery');
    }
    
    if (accessIntent === 'block') {
      opportunities.push('Consider allowing AI crawlers for better discoverability');
    }
    
    if (!robotsMetaAnalysis?.hasMetaRobots) {
      opportunities.push('Implement meta robots tags for page-level control');
    }
    
    return opportunities;
  }
}