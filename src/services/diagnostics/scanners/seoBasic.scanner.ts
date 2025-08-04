import { BaseScanner, ScannerContext, ScannerResult, IndicatorCategory } from './base';
import { extractMetaTags } from './base/scanner.utils';

interface SeoAnalysis {
  title: {
    exists: boolean;
    length?: number;
    optimal: boolean;
    issue?: string;
  };
  metaDescription: {
    exists: boolean;
    length?: number;
    optimal: boolean;
    issue?: string;
  };
  headings: {
    h1Count: number;
    hasH1: boolean;
    structure: string[];
    issue?: string;
  };
  openGraph: {
    hasBasicOg: boolean;
    missingTags: string[];
  };
}

export class SeoBasicScanner extends BaseScanner {
  name = 'seo_basic';
  category: IndicatorCategory = 'seo';
  description = 'Analyzes basic SEO elements including title, meta description, and headings';
  weight = 1.5;
  
  async scan(context: ScannerContext): Promise<ScannerResult> {
    if (!context.pageHtml) {
      return this.createResult({
        status: 'not_applicable',
        message: 'No HTML content available for SEO analysis',
        details: {
          reason: 'Page HTML not provided'
        }
      });
    }
    
    const analysis = this.analyzeSeo(context.pageHtml);
    const score = this.calculateSeoScore(analysis);
    const status = score >= 8 ? 'pass' : score >= 5 ? 'warn' : 'fail';
    
    return this.createResult({
      status,
      score,
      message: this.generateMessage(analysis),
      details: analysis,
      recommendation: this.generateRecommendations(analysis)
    });
  }
  
  private analyzeSeo(html: string): SeoAnalysis {
    const metaTags = extractMetaTags(html);
    
    // Analyze title
    const titleAnalysis = this.analyzeTitle(metaTags.title);
    
    // Analyze meta description
    const metaDescAnalysis = this.analyzeMetaDescription(metaTags.description);
    
    // Analyze headings
    const headingsAnalysis = this.analyzeHeadings(html);
    
    // Analyze Open Graph
    const ogAnalysis = this.analyzeOpenGraph(metaTags);
    
    return {
      title: titleAnalysis,
      metaDescription: metaDescAnalysis,
      headings: headingsAnalysis,
      openGraph: ogAnalysis
    };
  }
  
  private analyzeTitle(title?: string): SeoAnalysis['title'] {
    if (!title || title.trim().length === 0) {
      return {
        exists: false,
        optimal: false,
        issue: 'Missing title tag'
      };
    }
    
    const length = title.length;
    const optimal = length >= 30 && length <= 60;
    
    let issue: string | undefined;
    if (length < 30) {
      issue = 'Title too short (< 30 characters)';
    } else if (length > 60) {
      issue = 'Title too long (> 60 characters)';
    }
    
    return {
      exists: true,
      length,
      optimal,
      issue
    };
  }
  
  private analyzeMetaDescription(description?: string): SeoAnalysis['metaDescription'] {
    if (!description || description.trim().length === 0) {
      return {
        exists: false,
        optimal: false,
        issue: 'Missing meta description'
      };
    }
    
    const length = description.length;
    const optimal = length >= 120 && length <= 160;
    
    let issue: string | undefined;
    if (length < 120) {
      issue = 'Meta description too short (< 120 characters)';
    } else if (length > 160) {
      issue = 'Meta description too long (> 160 characters)';
    }
    
    return {
      exists: true,
      length,
      optimal,
      issue
    };
  }
  
  private analyzeHeadings(html: string): SeoAnalysis['headings'] {
    const h1Matches = html.match(/<h1[^>]*>([^<]*)<\/h1>/gi) || [];
    const h1Count = h1Matches.length;
    
    // Extract heading structure
    const headingRegex = /<h([1-6])[^>]*>([^<]*)<\/h\1>/gi;
    const structure: string[] = [];
    let match;
    
    while ((match = headingRegex.exec(html)) !== null) {
      const level = match[1];
      const text = match[2].trim();
      if (text) {
        structure.push(`H${level}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
      }
    }
    
    let issue: string | undefined;
    if (h1Count === 0) {
      issue = 'No H1 tag found';
    } else if (h1Count > 1) {
      issue = `Multiple H1 tags found (${h1Count})`;
    }
    
    return {
      h1Count,
      hasH1: h1Count > 0,
      structure: structure.slice(0, 10), // First 10 headings
      issue
    };
  }
  
  private analyzeOpenGraph(metaTags: Record<string, string>): SeoAnalysis['openGraph'] {
    const requiredOgTags = ['og:title', 'og:description', 'og:image', 'og:url'];
    const missingTags: string[] = [];
    
    for (const tag of requiredOgTags) {
      if (!metaTags[tag]) {
        missingTags.push(tag);
      }
    }
    
    return {
      hasBasicOg: missingTags.length === 0,
      missingTags
    };
  }
  
  private calculateSeoScore(analysis: SeoAnalysis): number {
    let score = 0;
    let maxScore = 0;
    
    // Title (3 points)
    maxScore += 3;
    if (analysis.title.exists) {
      score += analysis.title.optimal ? 3 : 1.5;
    }
    
    // Meta description (3 points)
    maxScore += 3;
    if (analysis.metaDescription.exists) {
      score += analysis.metaDescription.optimal ? 3 : 1.5;
    }
    
    // Headings (2 points)
    maxScore += 2;
    if (analysis.headings.hasH1 && analysis.headings.h1Count === 1) {
      score += 2;
    } else if (analysis.headings.hasH1) {
      score += 1;
    }
    
    // Open Graph (2 points)
    maxScore += 2;
    if (analysis.openGraph.hasBasicOg) {
      score += 2;
    } else if (analysis.openGraph.missingTags.length <= 2) {
      score += 1;
    }
    
    return Math.round((score / maxScore) * 10);
  }
  
  private generateMessage(analysis: SeoAnalysis): string {
    const issues: string[] = [];
    
    if (!analysis.title.exists) {
      issues.push('missing title');
    } else if (!analysis.title.optimal) {
      issues.push('suboptimal title length');
    }
    
    if (!analysis.metaDescription.exists) {
      issues.push('missing meta description');
    } else if (!analysis.metaDescription.optimal) {
      issues.push('suboptimal meta description length');
    }
    
    if (!analysis.headings.hasH1) {
      issues.push('missing H1');
    } else if (analysis.headings.h1Count > 1) {
      issues.push('multiple H1 tags');
    }
    
    if (!analysis.openGraph.hasBasicOg) {
      issues.push('incomplete Open Graph tags');
    }
    
    if (issues.length === 0) {
      return 'Excellent SEO implementation';
    } else if (issues.length <= 2) {
      return `Good SEO with minor issues: ${issues.join(', ')}`;
    } else {
      return `SEO needs improvement: ${issues.join(', ')}`;
    }
  }
  
  private generateRecommendations(analysis: SeoAnalysis): string {
    const recommendations: string[] = [];
    
    if (analysis.title.issue) {
      recommendations.push(analysis.title.issue);
    }
    
    if (analysis.metaDescription.issue) {
      recommendations.push(analysis.metaDescription.issue);
    }
    
    if (analysis.headings.issue) {
      recommendations.push(analysis.headings.issue);
    }
    
    if (analysis.openGraph.missingTags.length > 0) {
      recommendations.push(`Add missing Open Graph tags: ${analysis.openGraph.missingTags.join(', ')}`);
    }
    
    return recommendations.length > 0
      ? recommendations.join('. ')
      : 'SEO elements are well-optimized';
  }
}