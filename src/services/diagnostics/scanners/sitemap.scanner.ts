import { BaseScanner, ScannerContext, ScannerResult, IndicatorCategory } from './base';
import { fetchUrl, buildUrl, parseRobotsTxt } from './base/scanner.utils';

interface SitemapValidation {
  isValid: boolean;
  urlCount: number;
  issues: string[];
  hasLastmod: boolean;
  hasChangefreq: boolean;
  hasPriority: boolean;
}

export class SitemapScanner extends BaseScanner {
  name = 'xml_sitemap';
  category: IndicatorCategory = 'seo';
  description = 'Checks for XML sitemap presence and validity';
  weight = 1.0;
  
  async scan(context: ScannerContext): Promise<ScannerResult> {
    // Try to find sitemap URLs
    const sitemapUrls = await this.findSitemapUrls(context.siteUrl);
    
    if (sitemapUrls.length === 0) {
      return this.createResult({
        status: 'fail',
        score: 0.0,
        message: 'No XML sitemap found',
        details: {
          contentFound: false,
          validationIssues: ['No XML sitemap detected'],
          specificData: {
            checkedLocations: [
              '/sitemap.xml',
              '/sitemap_index.xml',
              'robots.txt'
            ]
          },
          aiReadinessFactors: [],
          aiOptimizationOpportunities: [
            'Create XML sitemap for better content discovery',
            'Reference sitemap in robots.txt',
            'Include all important pages in sitemap'
          ]
        },
        recommendation: 'Create an XML sitemap and reference it in robots.txt for better search engine discovery'
      });
    }
    
    // Validate each sitemap
    const validations = await Promise.all(
      sitemapUrls.map(url => this.validateSitemap(url))
    );
    
    // Aggregate results
    const totalUrls = validations.reduce((sum, v) => sum + (v?.urlCount || 0), 0);
    const validSitemaps = validations.filter(v => v?.isValid).length;
    const allIssues = validations.flatMap(v => v?.issues || []);
    
    if (validSitemaps === 0) {
      return this.createResult({
        status: 'fail',
        score: 0.2,
        message: 'Sitemap found but contains errors',
        details: {
          sitemapUrls,
          issues: allIssues,
          totalUrls
        },
        recommendation: 'Fix the validation errors in your XML sitemap'
      });
    }
    
    // Calculate score based on sitemap quality
    const hasOptionalElements = validations.some(v => 
      v?.hasLastmod || v?.hasChangefreq || v?.hasPriority
    );
    
    const score = hasOptionalElements ? 1.0 : 0.8;
    const status = allIssues.length > 0 ? 'warn' : 'pass';
    
    return this.createResult({
      status,
      score,
      message: `Valid XML sitemap${sitemapUrls.length > 1 ? 's' : ''} found with ${totalUrls} URLs`,
      details: {
        sitemapUrls,
        totalUrls,
        validSitemaps,
        hasLastmod: validations.some(v => v?.hasLastmod),
        hasChangefreq: validations.some(v => v?.hasChangefreq),
        hasPriority: validations.some(v => v?.hasPriority),
        issues: allIssues.length > 0 ? allIssues : undefined
      },
      recommendation: hasOptionalElements 
        ? 'Sitemap is well-structured'
        : 'Consider adding lastmod, changefreq, and priority tags for better SEO'
    });
  }
  
  private async findSitemapUrls(siteUrl: string): Promise<string[]> {
    const sitemapUrls: string[] = [];
    
    // Check common sitemap locations
    const commonPaths = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap.xml.gz'];
    
    for (const path of commonPaths) {
      const url = buildUrl(siteUrl, path);
      const result = await fetchUrl(url);
      if (result.found) {
        sitemapUrls.push(url);
      }
    }
    
    // Check robots.txt for sitemap references
    const robotsUrl = buildUrl(siteUrl, '/robots.txt');
    const robotsResult = await fetchUrl(robotsUrl);
    
    if (robotsResult.found && robotsResult.content) {
      const parsed = parseRobotsTxt(robotsResult.content);
      sitemapUrls.push(...parsed.sitemaps);
    }
    
    // Remove duplicates
    return [...new Set(sitemapUrls)];
  }
  
  private async validateSitemap(url: string): Promise<SitemapValidation | null> {
    const result = await fetchUrl(url);
    
    if (!result.found || !result.content) {
      return null;
    }
    
    const validation: SitemapValidation = {
      isValid: false,
      urlCount: 0,
      issues: [],
      hasLastmod: false,
      hasChangefreq: false,
      hasPriority: false
    };
    
    try {
      // Basic XML validation
      if (!result.content.includes('<?xml') || !result.content.includes('<urlset')) {
        validation.issues.push('Invalid XML sitemap format');
        return validation;
      }
      
      // Count URLs
      const urlMatches = result.content.match(/<url>/gi);
      validation.urlCount = urlMatches ? urlMatches.length : 0;
      
      if (validation.urlCount === 0) {
        validation.issues.push('Sitemap contains no URLs');
        return validation;
      }
      
      // Check for optional elements
      validation.hasLastmod = result.content.includes('<lastmod>');
      validation.hasChangefreq = result.content.includes('<changefreq>');
      validation.hasPriority = result.content.includes('<priority>');
      
      // Validate URL format within sitemap
      const locMatches = result.content.match(/<loc>([^<]+)<\/loc>/gi);
      if (locMatches) {
        for (const match of locMatches.slice(0, 10)) { // Check first 10 URLs
          const urlMatch = match.match(/<loc>([^<]+)<\/loc>/i);
          if (urlMatch) {
            try {
              new URL(urlMatch[1]);
            } catch {
              validation.issues.push(`Invalid URL in sitemap: ${urlMatch[1]}`);
            }
          }
        }
      }
      
      // Check sitemap size (should be < 50MB uncompressed, < 50k URLs)
      if (validation.urlCount > 50000) {
        validation.issues.push('Sitemap exceeds 50,000 URL limit');
      }
      
      if (result.content.length > 50 * 1024 * 1024) {
        validation.issues.push('Sitemap exceeds 50MB size limit');
      }
      
      validation.isValid = validation.issues.length === 0;
      
    } catch (error: any) {
      validation.issues.push(`Sitemap parsing error: ${error.message || String(error)}`);
    }
    
    return validation;
  }
}