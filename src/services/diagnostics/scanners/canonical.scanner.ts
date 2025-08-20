import { BaseScanner, ScannerContext, ScannerResult, IndicatorCategory } from './base';
import { extractMetaTags } from './base/scanner.utils';
import { URL } from 'url';

export class CanonicalScanner extends BaseScanner {
  name = 'canonical_urls';
  category: IndicatorCategory = 'seo';
  description = 'Validates canonical URL implementation for proper content indexing';
  weight = 1.0;
  
  async scan(context: ScannerContext): Promise<ScannerResult> {
    if (!context.pageHtml) {
      return this.createResult({
        status: 'not_applicable',
        message: 'No HTML content available for canonical URL analysis',
        details: {
          reason: 'Page HTML not provided'
        }
      });
    }
    
    const canonicalUrl = this.extractCanonicalUrl(context.pageHtml);
    const metaTags = extractMetaTags(context.pageHtml);
    
    if (!canonicalUrl) {
      return this.createResult({
        status: 'warn',
        score: 0.3,
        message: 'No canonical URL specified',
        details: {
          pageUrl: context.pageUrl
        },
        recommendation: 'Add a canonical URL link tag to prevent duplicate content issues'
      });
    }
    
    // Validate canonical URL
    const validation = this.validateCanonicalUrl(canonicalUrl, context.pageUrl || context.siteUrl);
    
    if (!validation.isValid) {
      return this.createResult({
        status: 'fail',
        score: 0.0,
        message: 'Invalid canonical URL implementation',
        details: {
          canonicalUrl,
          issues: validation.issues,
          pageUrl: context.pageUrl
        },
        recommendation: validation.recommendation
      });
    }
    
    // Check for consistency with OG URL if present
    const ogUrl = metaTags['og:url'];
    const consistency = this.checkUrlConsistency(canonicalUrl, ogUrl);
    
    if (!consistency.isConsistent) {
      return this.createResult({
        status: 'warn',
        score: 0.7,
        message: 'Canonical URL inconsistency detected',
        details: {
          canonicalUrl,
          ogUrl,
          issue: consistency.issue
        },
        recommendation: 'Ensure canonical URL and og:url meta tag are consistent'
      });
    }
    
    return this.createResult({
      status: 'pass',
      score: 1.0,
      message: 'Proper canonical URL implementation',
      details: {
        canonicalUrl,
        isAbsolute: validation.isAbsolute,
        matchesOgUrl: consistency.isConsistent
      }
    });
  }
  
  private extractCanonicalUrl(html: string): string | null {
    // Look for <link rel="canonical" href="...">
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i);
    if (!canonicalMatch) return null;
    
    const hrefMatch = canonicalMatch[0].match(/href=["']([^"']+)["']/i);
    return hrefMatch ? hrefMatch[1] : null;
  }
  
  private validateCanonicalUrl(canonicalUrl: string, pageUrl: string): {
    isValid: boolean;
    isAbsolute: boolean;
    issues: string[];
    recommendation: string;
  } {
    const issues: string[] = [];
    let isAbsolute = false;
    
    try {
      // Check if URL is absolute
      const url = new URL(canonicalUrl);
      isAbsolute = true;
      
      // Validate protocol
      if (!['http:', 'https:'].includes(url.protocol)) {
        issues.push('Invalid protocol (must be http or https)');
      }
      
      // Check for query parameters that might cause issues
      if (url.searchParams.toString() && !this.isAcceptableQueryParam(url.searchParams)) {
        issues.push('Contains potentially problematic query parameters');
      }
    } catch {
      // Not an absolute URL
      issues.push('Canonical URL must be absolute (include protocol and domain)');
    }
    
    // Check for common mistakes
    if (canonicalUrl.includes(' ')) {
      issues.push('URL contains spaces');
    }
    
    if (canonicalUrl.endsWith('index.html') || canonicalUrl.endsWith('index.php')) {
      issues.push('Avoid including index files in canonical URLs');
    }
    
    const recommendation = issues.length > 0
      ? `Fix canonical URL issues: ${issues.join(', ')}`
      : 'Use absolute URLs with HTTPS protocol for canonical tags';
    
    return {
      isValid: issues.length === 0,
      isAbsolute,
      issues,
      recommendation
    };
  }
  
  private isAcceptableQueryParam(params: URLSearchParams): boolean {
    // Some query parameters are acceptable in canonical URLs
    const acceptableParams = ['page', 'sort', 'category', 'tag'];
    
    for (const [key] of params) {
      if (!acceptableParams.includes(key.toLowerCase())) {
        return false;
      }
    }
    
    return true;
  }
  
  private checkUrlConsistency(canonicalUrl: string, ogUrl?: string): {
    isConsistent: boolean;
    issue?: string;
  } {
    if (!ogUrl) {
      return { isConsistent: true };
    }
    
    // Normalize URLs for comparison
    try {
      const canonical = new URL(canonicalUrl);
      const og = new URL(ogUrl);
      
      // Remove trailing slashes for comparison
      const canonicalPath = canonical.pathname.replace(/\/$/, '');
      const ogPath = og.pathname.replace(/\/$/, '');
      
      if (canonical.hostname !== og.hostname) {
        return {
          isConsistent: false,
          issue: 'Different domains in canonical and og:url'
        };
      }
      
      if (canonicalPath !== ogPath) {
        return {
          isConsistent: false,
          issue: 'Different paths in canonical and og:url'
        };
      }
      
      return { isConsistent: true };
    } catch {
      return {
        isConsistent: false,
        issue: 'Invalid URL format in canonical or og:url'
      };
    }
  }
}