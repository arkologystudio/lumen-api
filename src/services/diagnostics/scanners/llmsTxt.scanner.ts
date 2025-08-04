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
        score: 0,
        message: 'No llms.txt file found',
        details: {
          error: result.error,
          statusCode: result.statusCode
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
        score: 5,
        message: 'llms.txt file found but has issues',
        details: {
          issues: validation.issues,
          content: result.content
        },
        recommendation: 'Fix the issues in your llms.txt file to ensure proper AI agent compatibility',
        checkedUrl: llmsTxtUrl,
        found: true,
        isValid: false
      });
    }
    
    return this.createResult({
      status: 'pass',
      score: 10,
      message: 'Valid llms.txt file found',
      details: {
        parsedContent: validation.parsedContent,
        directives: validation.directiveCount
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