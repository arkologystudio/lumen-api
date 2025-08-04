import { BaseScanner, ScannerContext, ScannerResult, IndicatorCategory } from './base';
import { extractJsonLd } from './base/scanner.utils';

interface JsonLdAnalysis {
  found: boolean;
  count: number;
  types: string[];
  hasOrganization: boolean;
  hasWebSite: boolean;
  hasWebPage: boolean;
  hasBreadcrumb: boolean;
  hasProduct: boolean;
  hasArticle: boolean;
  validationIssues: string[];
  aiRelevantTypes: string[];
}

export class JsonLdScanner extends BaseScanner {
  name = 'json_ld';
  category: IndicatorCategory = 'structured_data';
  description = 'Analyzes JSON-LD structured data for search engine and AI understanding';
  weight = 2.0;
  
  private aiRelevantTypes = [
    'Organization',
    'Corporation',
    'LocalBusiness',
    'WebSite',
    'WebPage',
    'Article',
    'NewsArticle',
    'BlogPosting',
    'Product',
    'Service',
    'FAQPage',
    'HowTo',
    'Recipe',
    'Event',
    'Person',
    'VideoObject',
    'ImageObject'
  ];
  
  async scan(context: ScannerContext): Promise<ScannerResult> {
    if (!context.pageHtml) {
      return this.createResult({
        status: 'not_applicable',
        message: 'No HTML content available for JSON-LD analysis',
        details: {
          reason: 'Page HTML not provided'
        }
      });
    }
    
    const jsonLdScripts = extractJsonLd(context.pageHtml);
    const analysis = this.analyzeJsonLd(jsonLdScripts);
    
    if (!analysis.found) {
      return this.createResult({
        status: 'fail',
        score: 0,
        message: 'No JSON-LD structured data found',
        details: analysis,
        recommendation: 'Add JSON-LD structured data to help search engines and AI agents understand your content'
      });
    }
    
    const score = this.calculateJsonLdScore(analysis);
    const status = score >= 8 ? 'pass' : score >= 3 ? 'warn' : 'fail';
    
    return this.createResult({
      status,
      score,
      message: this.generateMessage(analysis),
      details: analysis,
      recommendation: this.generateRecommendations(analysis)
    });
  }
  
  private analyzeJsonLd(scripts: any[]): JsonLdAnalysis {
    const analysis: JsonLdAnalysis = {
      found: scripts.length > 0,
      count: scripts.length,
      types: [],
      hasOrganization: false,
      hasWebSite: false,
      hasWebPage: false,
      hasBreadcrumb: false,
      hasProduct: false,
      hasArticle: false,
      validationIssues: [],
      aiRelevantTypes: []
    };
    
    if (scripts.length === 0) {
      return analysis;
    }
    
    for (const script of scripts) {
      // Extract types
      const types = this.extractTypes(script);
      analysis.types.push(...types);
      
      // Check for specific types
      for (const type of types) {
        if (type.includes('Organization') || type.includes('Corporation')) {
          analysis.hasOrganization = true;
        }
        if (type === 'WebSite') {
          analysis.hasWebSite = true;
        }
        if (type === 'WebPage') {
          analysis.hasWebPage = true;
        }
        if (type === 'BreadcrumbList') {
          analysis.hasBreadcrumb = true;
        }
        if (type === 'Product') {
          analysis.hasProduct = true;
        }
        if (type.includes('Article') || type === 'BlogPosting') {
          analysis.hasArticle = true;
        }
        
        // Check if type is AI-relevant
        if (this.aiRelevantTypes.some(aiType => type.includes(aiType))) {
          analysis.aiRelevantTypes.push(type);
        }
      }
      
      // Validate structure
      const issues = this.validateJsonLdStructure(script);
      analysis.validationIssues.push(...issues);
    }
    
    // Remove duplicates
    analysis.types = [...new Set(analysis.types)];
    analysis.aiRelevantTypes = [...new Set(analysis.aiRelevantTypes)];
    analysis.validationIssues = [...new Set(analysis.validationIssues)];
    
    return analysis;
  }
  
  private extractTypes(obj: any): string[] {
    const types: string[] = [];
    
    if (typeof obj === 'object' && obj !== null) {
      if (obj['@type']) {
        if (Array.isArray(obj['@type'])) {
          types.push(...obj['@type']);
        } else {
          types.push(obj['@type']);
        }
      }
      
      // Recursively check nested objects
      for (const key in obj) {
        if (typeof obj[key] === 'object') {
          types.push(...this.extractTypes(obj[key]));
        }
      }
    }
    
    return types;
  }
  
  private validateJsonLdStructure(obj: any): string[] {
    const issues: string[] = [];
    
    // Check for @context
    if (!obj['@context']) {
      issues.push('Missing @context property');
    } else if (typeof obj['@context'] === 'string' && !obj['@context'].includes('schema.org')) {
      issues.push('@context should reference schema.org');
    }
    
    // Check for @type
    if (!obj['@type']) {
      issues.push('Missing @type property');
    }
    
    // Type-specific validation
    const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
    
    if (types.some(type => type === 'Organization' || type?.includes('Organization'))) {
      if (!obj.name) issues.push('Organization missing name property');
      if (!obj.url) issues.push('Organization missing url property');
    }
    
    if (types.includes('WebSite')) {
      if (!obj.url) issues.push('WebSite missing url property');
      if (!obj.name) issues.push('WebSite missing name property');
    }
    
    if (types.includes('Product')) {
      if (!obj.name) issues.push('Product missing name property');
      if (!obj.description) issues.push('Product missing description property');
    }
    
    if (types.some(type => type?.includes('Article'))) {
      if (!obj.headline) issues.push('Article missing headline property');
      if (!obj.author) issues.push('Article missing author property');
      if (!obj.datePublished) issues.push('Article missing datePublished property');
    }
    
    return issues;
  }
  
  private calculateJsonLdScore(analysis: JsonLdAnalysis): number {
    let score = 0;
    
    // Base score for having JSON-LD
    if (analysis.found) {
      score += 5; // Increased base score
    }
    
    // Points for important types
    if (analysis.hasOrganization || analysis.hasWebSite) {
      score += 3; // Increased importance score
    }
    
    if (analysis.hasWebPage || analysis.hasBreadcrumb) {
      score += 1;
    }
    
    if (analysis.hasProduct || analysis.hasArticle) {
      score += 2; // Increased bonus for content types
    }
    
    // Points for AI-relevant types
    if (analysis.aiRelevantTypes.length > 0) {
      score += Math.min(3, analysis.aiRelevantTypes.length * 1); // Increased multiplier
    }
    
    // Multiple structured data objects is good
    if (analysis.count > 1) {
      score += 1;
    }
    
    // Deduct for validation issues (do this after positive scoring)
    if (analysis.validationIssues.length > 0) {
      // Be more lenient with Article validation (common to have partial data)
      const hasArticleIssues = analysis.validationIssues.some(issue => issue.includes('Article'));
      const penalty = hasArticleIssues ? 0.5 : 1.0;
      score -= Math.min(4, analysis.validationIssues.length * penalty);
    }
    
    return Math.max(0, Math.min(10, Math.round(score)));
  }
  
  private generateMessage(analysis: JsonLdAnalysis): string {
    if (!analysis.found) {
      return 'No structured data found';
    }
    
    const typeCount = analysis.types.length;
    const aiTypeCount = analysis.aiRelevantTypes.length;
    
    if (analysis.validationIssues.length > 0) {
      return `Found ${typeCount} structured data types with ${analysis.validationIssues.length} validation issues`;
    }
    
    if (aiTypeCount > 0) {
      return `Excellent structured data with ${aiTypeCount} AI-relevant types`;
    }
    
    return `Basic structured data found with ${typeCount} types`;
  }
  
  private generateRecommendations(analysis: JsonLdAnalysis): string {
    const recommendations: string[] = [];
    
    if (!analysis.found) {
      recommendations.push('Add JSON-LD structured data to improve search visibility');
    }
    
    if (!analysis.hasOrganization && !analysis.hasWebSite) {
      recommendations.push('Add Organization or WebSite schema for better brand recognition');
    }
    
    if (!analysis.hasBreadcrumb) {
      recommendations.push('Consider adding BreadcrumbList for better navigation context');
    }
    
    if (analysis.validationIssues.length > 0) {
      recommendations.push(`Fix validation issues: ${analysis.validationIssues.slice(0, 3).join(', ')}`);
    }
    
    if (analysis.aiRelevantTypes.length === 0 && analysis.found) {
      recommendations.push('Consider using AI-relevant schema types like Article, Product, or FAQPage');
    }
    
    return recommendations.length > 0
      ? recommendations.join('. ')
      : 'Structured data is well-implemented for AI agents';
  }
}