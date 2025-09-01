import { PrismaClient } from '@prisma/client';
import { CrawlerService, SiteCrawlOptions } from './crawler/crawlerService';
import { ScannerRegistry, ScannerContext, initializeScanners } from './scanners';
import { isRobotsAnalysisData, StandardEvidence } from './scanners/base';
import { LighthouseAIReport, DiagnosticAggregator } from './aggregator';
import { SiteProfile } from './profileDetector';
// import { createClient } from '@supabase/supabase-js';

export interface DiagnosticServiceConfig {
  prisma: PrismaClient;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  storageBucket?: string;
}

export interface RunDiagnosticOptions {
  auditType?: 'full' | 'quick' | 'scheduled' | 'on_demand';
  includeSitemap?: boolean;
  maxPages?: number;
  storeRawData?: boolean;
  skipCache?: boolean;
  declaredProfile?: SiteProfile; // Allow client to declare site profile
}

export interface DiagnosticResult {
  auditId: string;
  status: 'completed' | 'failed' | 'partial';
  result?: LighthouseAIReport;
  error?: string;
  duration: number;
}

export class DiagnosticsService {
  private prisma: PrismaClient;
  private crawler: CrawlerService;
  private scannerRegistry: ScannerRegistry;
  private aggregator: DiagnosticAggregator;
  // private supabase: any;
  
  constructor(config: DiagnosticServiceConfig) {
    this.prisma = config.prisma;
    this.aggregator = new DiagnosticAggregator();
    
    // Initialize scanner registry
    this.scannerRegistry = initializeScanners();
    
    // Initialize Supabase if configured
    // if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    //   this.supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
    // }
    
    // Initialize crawler service
    this.crawler = new CrawlerService({
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseServiceRoleKey,
      storageBucket: config.storageBucket
    });
  }
  
  /**
   * Run a comprehensive diagnostic audit for a site
   */
  async runDiagnostic(
    userId: string, 
    siteId: string, 
    options: RunDiagnosticOptions = {}
  ): Promise<DiagnosticResult> {
    const startTime = Date.now();
    let auditId: string | null = null;
    
    try {
      // Get site information
      const site = await this.prisma.site.findFirst({
        where: { id: siteId, user_id: userId }
      });
      
      if (!site) {
        throw new Error('Site not found or access denied');
      }
      
      // Check cache if not skipping
      if (!options.skipCache) {
        const cachedResult = await this.getCachedResult(siteId);
        if (cachedResult) {
          return {
            auditId: cachedResult.id,
            status: 'completed',
            result: this.convertCachedToSpec(cachedResult),
            duration: Date.now() - startTime
          };
        }
      }
      
      // Create audit record
      const audit = await this.prisma.diagnosticAudit.create({
        data: {
          user_id: userId,
          site_id: siteId,
          audit_type: options.auditType || 'full',
          status: 'pending'
        }
      });
      
      auditId = audit.id;
      
      // Update status to crawling
      await this.updateAuditStatus(auditId, 'crawling');
      
      // Crawl the site
      const crawlOptions: SiteCrawlOptions = {
        includeSitemap: options.includeSitemap,
        maxPages: options.maxPages || 5,
        storeRawData: options.storeRawData || false,
        timeout: 30000
      };
      
      const crawlResult = await this.crawler.crawlSite(site.url, crawlOptions);
      
      if (crawlResult.pages.length === 0) {
        throw new Error('No pages could be crawled');
      }
      
      // Update status to scanning
      await this.updateAuditStatus(auditId, 'scanning');
      
      // Run scanners on crawled pages
      const pageResults = new Map<string, any[]>();
      
      for (const page of crawlResult.pages) {
        if (page.statusCode === 200 && page.html) {
          // Create scanner context
          const context: ScannerContext = {
            auditId,
            siteUrl: site.url,
            pageUrl: page.url,
            pageHtml: page.html,
            pageMetadata: {
              title: page.title,
              metaDescription: page.metaDescription,
              statusCode: page.statusCode,
              loadTimeMs: page.loadTimeMs,
              wordCount: page.wordCount
            },
            crawlerMetadata: {
              crawledAt: new Date()
            }
          };
          
          // Run all applicable scanners
          const scanResults = await this.scannerRegistry.runAllScanners(context);
          pageResults.set(page.url, scanResults);
        }
      }
      
      // Update status to scoring
      await this.updateAuditStatus(auditId, 'scoring');
      
      // Aggregate results using spec-compliant aggregator
      const aggregatedResult = this.aggregator.aggregate(
        site.url,
        pageResults,
        options.declaredProfile
      );
      
      // Store results in database
      await this.storeResults(auditId, aggregatedResult, crawlResult);
      
      // Update status to completed
      await this.updateAuditStatus(auditId, 'completed', {
        site_score: aggregatedResult.overall.score_0_100,
        ai_readiness: this.determineAiReadinessFromSpec(aggregatedResult),
        access_intent: this.determineAccessIntentFromSpec(aggregatedResult),
        completed_at: new Date()
      });
      
      return {
        auditId,
        status: 'completed',
        result: aggregatedResult,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('Diagnostic audit failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (auditId) {
        await this.updateAuditStatus(auditId, 'failed', {
          error_message: errorMessage,
          completed_at: new Date()
        });
      }
      
      return {
        auditId: auditId || 'unknown',
        status: 'failed',
        error: errorMessage,
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Run an anonymous diagnostic scan on any URL without authentication
   * Does not store results in database - returns ephemeral results
   */
  async runAnonymousDiagnostic(
    url: string, 
    options: RunDiagnosticOptions = {}
  ): Promise<DiagnosticResult> {
    const startTime = Date.now();
    
    try {
      // Validate URL format and accessibility
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        throw new Error('Invalid URL format');
      }
      
      // Security check - only allow http/https
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only HTTP and HTTPS URLs are allowed');
      }
      
      console.log(`[Diagnostics] Starting anonymous scan for: ${url}`);
      
      // Crawl the site with anonymous limits
      const crawlOptions: SiteCrawlOptions = {
        includeSitemap: false, // Never include sitemap for anonymous
        maxPages: Math.min(options.maxPages || 3, 3), // Strict 3-page limit
        storeRawData: false, // Never store raw data for anonymous
        timeout: 15000 // Shorter timeout for anonymous scans
      };
      
      const crawlResult = await this.crawler.crawlSite(url, crawlOptions);
      
      if (crawlResult.pages.length === 0) {
        throw new Error('No pages could be crawled - site may be unreachable');
      }
      
      console.log(`[Diagnostics] Crawled ${crawlResult.pages.length} pages, running scanners...`);
      
      // Run scanners on crawled pages (no database storage)
      const pageResults = new Map<string, any[]>();
      const tempAuditId = `anonymous-${Date.now()}`; // Temporary audit ID for context
      
      for (const page of crawlResult.pages) {
        if (page.statusCode === 200 && page.html) {
          // Create scanner context
          const context: ScannerContext = {
            auditId: tempAuditId,
            siteUrl: url,
            pageUrl: page.url,
            pageHtml: page.html,
            pageMetadata: {
              title: page.title,
              metaDescription: page.metaDescription,
              statusCode: page.statusCode,
              loadTimeMs: page.loadTimeMs,
              wordCount: page.wordCount
            },
            crawlerMetadata: {
              crawledAt: new Date()
            }
          };
          
          // Run all applicable scanners
          const scanResults = await this.scannerRegistry.runAllScanners(context);
          pageResults.set(page.url, scanResults);
        }
      }
      
      console.log(`[Diagnostics] Scanning complete, aggregating results...`);
      
      // Aggregate results without database storage
      const aggregatedResult = this.aggregator.aggregate(
        url,
        pageResults,
        options.declaredProfile
      );
      
      console.log(`[Diagnostics] Anonymous scan completed in ${Date.now() - startTime}ms`);
      
      return {
        auditId: tempAuditId,
        status: 'completed',
        result: aggregatedResult,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('Anonymous diagnostic scan failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        auditId: `anonymous-failed-${Date.now()}`,
        status: 'failed',
        error: errorMessage,
        duration: Date.now() - startTime
      };
    }
  }
  
  /**
   * Get the latest diagnostic result for a site
   */
  async getLatestDiagnostic(userId: string, siteId: string): Promise<LighthouseAIReport | null> {
    const audit = await this.prisma.diagnosticAudit.findFirst({
      where: {
        site_id: siteId,
        user_id: userId,
        status: 'completed'
      },
      include: {
        pages: true,
        indicators: true,
        scores: true
      },
      orderBy: {
        completed_at: 'desc'
      }
    });
    
    if (!audit) return null;
    
    return this.convertCachedToSpec(audit);
  }
  
  private async updateAuditStatus(auditId: string, status: string, additionalData: any = {}): Promise<void> {
    await this.prisma.diagnosticAudit.update({
      where: { id: auditId },
      data: {
        status,
        ...additionalData
      }
    });
  }
  
  private async getCachedResult(siteId: string): Promise<any | null> {
    const cacheHours = 24; // Cache for 24 hours
    const cacheExpiry = new Date(Date.now() - cacheHours * 60 * 60 * 1000);
    
    return await this.prisma.diagnosticAudit.findFirst({
      where: {
        site_id: siteId,
        status: 'completed',
        completed_at: {
          gte: cacheExpiry
        }
      },
      include: {
        pages: true,
        indicators: true,
        scores: true
      },
      orderBy: {
        completed_at: 'desc'
      }
    });
  }
  
  
  /**
   * Store spec-compliant results in database
   */
  private async storeResults(auditId: string, result: LighthouseAIReport, crawlResult: any): Promise<void> {
    // Store the spec-compliant overall score
    await this.prisma.diagnosticScore.create({
      data: {
        audit_id: auditId,
        score_type: 'spec_overall',
        score_value: result.overall.score_0_100,
        total_indicators: 0,
        passed_indicators: 0,
        warning_indicators: 0,
        failed_indicators: 0
      }
    });
    
    // Store category scores
    for (const [categoryName, category] of Object.entries(result.categories)) {
      const categoryIndicators = Object.keys(category.indicator_scores)
        .map(name => result.indicators[name])
        .filter(indicator => indicator?.applicability.included_in_category_math);
      
      await this.prisma.diagnosticScore.create({
        data: {
          audit_id: auditId,
          score_type: 'spec_category',
          category: categoryName,
          score_value: category.score * 100, // Convert to 0-100 for consistency
          total_indicators: categoryIndicators.length,
          passed_indicators: categoryIndicators.filter(indicator => indicator.score === 1.0).length,
          warning_indicators: categoryIndicators.filter(indicator => indicator.score === 0.5).length,
          failed_indicators: categoryIndicators.filter(indicator => indicator.score === 0.0).length
        }
      });
    }
    
    // Note: Full spec result could be stored in a separate JSON column if added to schema
  }
  
  /**
   * Determine AI readiness from spec-compliant result
   */
  private determineAiReadinessFromSpec(result: LighthouseAIReport): 'excellent' | 'good' | 'needs_improvement' | 'poor' {
    const score = result.overall.score_0_100;
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'needs_improvement';
    return 'poor';
  }
  
  /**
   * Determine access intent from spec-compliant result
   */
  private determineAccessIntentFromSpec(result: LighthouseAIReport): 'allow' | 'partial' | 'block' {
    // Check robots.txt indicator in indicators object
    const robotsIndicator = result.indicators['robots_txt'];
    if (robotsIndicator?.evidence && typeof robotsIndicator.evidence === 'object') {
      const evidence = robotsIndicator.evidence as StandardEvidence;
      if (evidence.analysis && isRobotsAnalysisData(evidence.analysis)) {
        return evidence.analysis.accessIntent || 'allow';
      }
    }
    return 'allow'; // Default
  }
  
  /**
   * Convert cached result to spec-compliant format
   */
  private convertCachedToSpec(audit: any): LighthouseAIReport {
    // This would need to be implemented based on cached data structure
    // For now, return a basic structure
    return {
      site: {
        url: audit.site?.url || 'unknown',
        scan_date: new Date().toISOString().split('T')[0],
        category: 'custom',
        profile_detection: {
          confidence: 0.0,
          method: 'heuristic',
          signals: ['Cached result - no profile detection']
        }
      },
      categories: {
        discovery: { score: 0, indicator_scores: {} },
        understanding: { score: 0, indicator_scores: {} },
        actions: { score: 0, indicator_scores: {} },
        trust: { score: 0, indicator_scores: {} }
      },
      indicators: {},
      weights: {
        discovery: 0.30,
        understanding: 0.30,
        actions: 0.25,
        trust: 0.15
      },
      overall: {
        raw_0_1: 0,
        score_0_100: 0
      }
    };
  }
}