import { BaseScanner, ScannerContext, ScannerResult, IndicatorCategory, IndicatorStatus } from './base';
import { fetchUrl, buildUrl, parseRobotsTxt, extractRobotsMeta } from './base/scanner.utils';

export class RobotsScanner extends BaseScanner {
  name = 'robots_txt';
  category: IndicatorCategory = 'standards';
  description = 'Checks for robots.txt file presence (binary scoring: exists = 100%, missing = 0%)';
  weight = 1.0;
  
  async scan(context: ScannerContext): Promise<ScannerResult> {
    const robotsTxtUrl = buildUrl(context.siteUrl, '/robots.txt');
    const robotsTxtResult = await fetchUrl(robotsTxtUrl);
    
    // Simple binary scoring: exists = 1.0 (100%), missing = 0.0 (0%)
    const score = robotsTxtResult.found ? 1.0 : 0.0;
    const status: IndicatorStatus = robotsTxtResult.found ? 'pass' : 'fail';
    const message = robotsTxtResult.found ? 'robots.txt file found' : 'robots.txt file not found';
    
    // Still analyze for access intent determination (used elsewhere in system)
    let robotsTxtAnalysis: any = null;
    let robotsMetaAnalysis: any = null;
    
    if (robotsTxtResult.found) {
      robotsTxtAnalysis = this.analyzeRobotsTxt(robotsTxtResult.content || '');
    }
    
    if (context.pageHtml) {
      robotsMetaAnalysis = this.analyzeRobotsMeta(context.pageHtml);
    }
    
    const accessIntent = this.determineAccessIntent(robotsTxtAnalysis, robotsMetaAnalysis);
    
    return this.createResult({
      status,
      score,
      message,
      details: this.createStandardEvidence({
        statusCode: robotsTxtResult.statusCode,
        contentFound: robotsTxtResult.found,
        contentPreview: robotsTxtResult.found ? 
          robotsTxtResult.content?.substring(0, 200) + (robotsTxtResult.content && robotsTxtResult.content.length > 200 ? '...' : '') 
          : undefined,
        validationScore: Math.round(score * 100),
        specificData: {
          robotsTxt: robotsTxtAnalysis,
          robotsMeta: robotsMetaAnalysis,
          accessIntent,
          aiAgentRestrictions: robotsTxtAnalysis?.aiUserAgents || [],
          sitemapReferences: robotsTxtAnalysis?.sitemapCount || 0,
          hasAiDirectives: robotsTxtAnalysis?.hasAiDirectives || false
        },
        aiReadinessFactors: this.generateAiReadinessFactors(robotsTxtResult.found),
        aiOptimizationOpportunities: this.generateAiOptimizationOpportunities(robotsTxtResult.found),
        checkedUrl: robotsTxtUrl
      }),
      recommendation: this.generateRecommendation(robotsTxtResult.found),
      checkedUrl: robotsTxtUrl,
      found: robotsTxtResult.found,
      isValid: true
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
  
  private generateRecommendation(hasRobotsTxt: boolean): string {
    return hasRobotsTxt 
      ? 'robots.txt file exists'
      : 'Create a robots.txt file to control crawler access';
  }

  private generateAiReadinessFactors(hasRobotsTxt: boolean): string[] {
    return hasRobotsTxt 
      ? ['Robots.txt file exists for crawler guidance']
      : [];
  }

  private generateAiOptimizationOpportunities(hasRobotsTxt: boolean): string[] {
    return hasRobotsTxt 
      ? []
      : ['Create robots.txt file to guide AI crawlers'];
  }
}