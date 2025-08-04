import { PrismaClient } from '@prisma/client';
import { CrawlerService, SiteCrawlOptions } from './crawler';
import { ScannerRegistry, ScannerContext, initializeScanners } from './scanners';
import { DiagnosticAggregator, AggregatedResult } from './aggregator';
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
}

export interface DiagnosticResult {
  auditId: string;
  status: 'completed' | 'failed' | 'partial';
  result?: AggregatedResult;
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
            result: this.convertCachedToAggregated(cachedResult),
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
      
      // Aggregate results
      const aggregatedResult = this.aggregator.aggregate(auditId, site.url, pageResults);
      
      // Store results in database
      await this.storeResults(auditId, aggregatedResult, crawlResult);
      
      // Update status to completed
      await this.updateAuditStatus(auditId, 'completed', {
        site_score: aggregatedResult.siteScore.overall,
        ai_readiness: aggregatedResult.aiReadiness,
        access_intent: aggregatedResult.accessIntent,
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
   * Get the latest diagnostic result for a site
   */
  async getLatestDiagnostic(userId: string, siteId: string): Promise<AggregatedResult | null> {
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
    
    return this.convertCachedToAggregated(audit);
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
  
  private async storeResults(auditId: string, result: AggregatedResult, crawlResult: any): Promise<void> {
    // Store page-level data
    for (const page of result.pages) {
      const pageRecord = await this.prisma.diagnosticPage.create({
        data: {
          audit_id: auditId,
          url: page.url,
          page_score: page.pageScore,
          // Add other page fields as needed
        }
      });
      
      // Store indicators for this page
      for (const indicator of page.indicators) {
        await this.prisma.diagnosticIndicator.create({
          data: {
            audit_id: auditId,
            page_id: pageRecord.id,
            indicator_name: indicator.indicatorName,
            category: indicator.category,
            status: indicator.status,
            score: indicator.score,
            weight: indicator.weight || 1,
            message: indicator.message,
            details: indicator.details ? JSON.stringify(indicator.details) : undefined,
            recommendation: indicator.recommendation,
            checked_url: indicator.checkedUrl,
            found: indicator.found || false,
            is_valid: indicator.isValid || false
          }
        });
      }
    }
    
    // Store site-level scores
    await this.prisma.diagnosticScore.create({
      data: {
        audit_id: auditId,
        score_type: 'site',
        score_value: result.siteScore.overall,
        total_indicators: result.summary.totalIndicators,
        passed_indicators: result.summary.passedIndicators,
        warning_indicators: result.summary.warningIndicators,
        failed_indicators: result.summary.failedIndicators,
        calculation_details: JSON.stringify(result.siteScore)
      }
    });
    
    // Store category scores
    for (const categoryScore of result.categoryScores) {
      await this.prisma.diagnosticScore.create({
        data: {
          audit_id: auditId,
          score_type: 'category',
          category: categoryScore.category,
          score_value: categoryScore.score,
          total_indicators: categoryScore.indicatorCount,
          passed_indicators: categoryScore.passedCount,
          warning_indicators: categoryScore.warningCount,
          failed_indicators: categoryScore.failedCount,
          calculation_details: JSON.stringify(categoryScore)
        }
      });
    }
  }
  
  private convertCachedToAggregated(audit: any): AggregatedResult {
    // Convert database records back to AggregatedResult format
    // This is a simplified version - in practice, you'd reconstruct the full object
    return {
      auditId: audit.id,
      siteUrl: audit.site?.url || 'unknown',
      pages: audit.pages?.map((page: any) => ({
        url: page.url,
        indicators: audit.indicators?.filter((i: any) => i.page_id === page.id) || [],
        pageScore: page.page_score || 0,
        categoryScores: [],
        issues: [],
        recommendations: []
      })) || [],
      siteScore: {
        overall: audit.site_score || 0,
        weighted: audit.site_score || 0,
        breakdown: {
          standards: 0,
          seo: 0,
          structured_data: 0,
          accessibility: 0,
          performance: 0,
          security: 0
        }
      },
      categoryScores: audit.scores?.filter((s: any) => s.score_type === 'category')?.map((s: any) => ({
        category: s.category,
        score: s.score_value,
        weight: 1,
        indicatorCount: s.total_indicators,
        passedCount: s.passed_indicators,
        warningCount: s.warning_indicators,
        failedCount: s.failed_indicators
      })) || [],
      summary: {
        totalIndicators: audit.indicators?.length || 0,
        passedIndicators: audit.indicators?.filter((i: any) => i.status === 'pass').length || 0,
        warningIndicators: audit.indicators?.filter((i: any) => i.status === 'warn').length || 0,
        failedIndicators: audit.indicators?.filter((i: any) => i.status === 'fail').length || 0,
        criticalIssues: [],
        topRecommendations: []
      },
      aiReadiness: audit.ai_readiness || 'poor',
      accessIntent: audit.access_intent || 'allow'
    };
  }
}