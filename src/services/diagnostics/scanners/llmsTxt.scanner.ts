import { BaseScanner, ScannerContext, ScannerResult, IndicatorCategory } from './base';
import { fetchUrl, buildUrl } from './base/scanner.utils';

interface LlmsTxtContent {
  userAgent?: string;
  disallow?: string[];
  allow?: string[];
  crawlDelay?: number;
  [key: string]: any;
}

export class LlmsTxtScanner extends BaseScanner {
  name = 'llms_txt';
  category: IndicatorCategory = 'standards';
  description = 'Checks for the presence and validity of llms.txt file for AI agent instructions';
  weight = 2.0; // Higher weight as it's a key AI-readiness indicator
  
  async scan(context: ScannerContext): Promise<ScannerResult> {
    const llmsTxtUrl = buildUrl(context.siteUrl, '/llms.txt');
    const result = await fetchUrl(llmsTxtUrl);
    
    if (!result.found) {
          return this.createResult({
      status: 'fail',
      score: 0.0,
      message: 'No llms.txt file found',
      details: {
        statusCode: result.statusCode,
        error: result.error,
        contentFound: false,
        contentPreview: null,
        validationIssues: ['File not found at /llms.txt'],
        specificData: {
          checkedPaths: ['/llms.txt'],
          expectedFormat: 'Plain text with directives like User-agent, Allow, Disallow',
          examples: ['User-agent: *', 'Allow: /api/', 'Crawl-delay: 1']
        },
        aiReadinessFactors: [],
        aiOptimizationOpportunities: [
          'Implement llms.txt file to provide AI agents with crawling instructions',
          'Define allowed/disallowed paths for AI crawlers',
          'Set appropriate crawl delays to manage server load'
        ]
      },
      recommendation: 'Create an llms.txt file at the root of your website to provide instructions for AI agents',
      checkedUrl: llmsTxtUrl,
      found: false,
      isValid: false
    });
    }
    
    // Parse and validate llms.txt content
    const validation = this.validateLlmsTxt(result.content || '');
    
    if (!validation.isValid) {
      return this.createResult({
        status: 'warn',
        score: 0.5,
        message: 'llms.txt file found but has issues',
        details: {
          statusCode: 200,
          contentFound: true,
          contentPreview: result.content?.substring(0, 200) + (result.content && result.content.length > 200 ? '...' : ''),
          validationIssues: validation.issues,
          validationScore: 0.5,
          specificData: {
            parsedContent: validation.parsedContent,
            directiveCount: validation.directiveCount,
            detectedDirectives: Object.keys(validation.parsedContent),
            contentLength: result.content?.length || 0
          },
          aiReadinessFactors: [
            'File exists but has validation issues',
            'Partial AI agent compatibility'
          ],
          aiOptimizationOpportunities: [
            'Fix validation issues to improve AI agent compatibility',
            'Add missing required directives',
            'Ensure proper formatting and syntax'
          ]
        },
        recommendation: 'Fix the issues in your llms.txt file to ensure proper AI agent compatibility',
        checkedUrl: llmsTxtUrl,
        found: true,
        isValid: false
      });
    }
    
    return this.createResult({
      status: 'pass',
      score: 1.0,
      message: 'Valid llms.txt file found',
      details: {
        statusCode: 200,
        contentFound: true,
        contentPreview: result.content?.substring(0, 200) + (result.content && result.content.length > 200 ? '...' : ''),
        validationScore: 1.0,
        specificData: {
          parsedContent: validation.parsedContent,
          directiveCount: validation.directiveCount,
          detectedDirectives: Object.keys(validation.parsedContent),
          contentLength: result.content?.length || 0,
          hasUserAgent: !!validation.parsedContent.userAgent,
          hasAllowDirectives: !!validation.parsedContent.allow?.length,
          hasDisallowDirectives: !!validation.parsedContent.disallow?.length,
          hasCrawlDelay: !!validation.parsedContent.crawlDelay
        },
        aiReadinessFactors: [
          'Valid llms.txt file provides AI agent instructions',
          'Proper directive formatting detected',
          'AI-friendly crawling guidelines established'
        ],
        aiOptimizationOpportunities: [
          'Well-configured for AI agent crawling',
          'Consider adding specific directives for new AI agents as they emerge'
        ]
      },
      checkedUrl: llmsTxtUrl,
      found: true,
      isValid: true
    });
  }
  
  private validateLlmsTxt(content: string): {
    isValid: boolean;
    issues: string[];
    parsedContent: LlmsTxtContent;
    directiveCount: number;
  } {
    const issues: string[] = [];
    const parsedContent: LlmsTxtContent = {};
    let directiveCount = 0;
    
    if (!content.trim()) {
      issues.push('File is empty');
      return { isValid: false, issues, parsedContent, directiveCount };
    }
    
    const lines = content.split('\n').map(line => line.trim());
    // let currentUserAgent: string | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) continue;
      
      // Parse directive
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        issues.push(`Line ${i + 1}: Invalid format, missing colon`);
        continue;
      }
      
      const directive = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();
      
      directiveCount++;
      
      switch (directive) {
        case 'user-agent':
          // currentUserAgent = value;
          parsedContent.userAgent = value;
          break;
          
        case 'disallow':
          if (!parsedContent.disallow) parsedContent.disallow = [];
          parsedContent.disallow.push(value);
          break;
          
        case 'allow':
          if (!parsedContent.allow) parsedContent.allow = [];
          parsedContent.allow.push(value);
          break;
          
        case 'crawl-delay':
          const delay = parseInt(value, 10);
          if (isNaN(delay) || delay < 0) {
            issues.push(`Line ${i + 1}: Invalid crawl-delay value`);
          } else {
            parsedContent.crawlDelay = delay;
          }
          break;
          
        default:
          // Store other directives as custom fields
          parsedContent[directive] = value;
      }
    }
    
    // Validate that there's at least a User-agent directive
    if (!parsedContent.userAgent) {
      issues.push('Missing User-agent directive');
    }
    
    return {
      isValid: issues.length === 0 && directiveCount > 0,
      issues,
      parsedContent,
      directiveCount
    };
  }
}