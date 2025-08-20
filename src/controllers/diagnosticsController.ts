import { Request, Response } from 'express';
import { DiagnosticsService, RunDiagnosticOptions } from '../services/diagnostics';
import { PrismaClient } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    subscription_tier: string;
  };
}

export class DiagnosticsController {
  private diagnosticsService: DiagnosticsService;
  private prisma: PrismaClient;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.diagnosticsService = new DiagnosticsService({
      prisma,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      storageBucket: 'diagnostics-storage'
    });
  }
  
  /**
   * POST /v1/diagnostics/scan-url
   * Run anonymous diagnostic scan on any URL (no authentication required)
   */
  scanUrl = async (req: Request, res: Response): Promise<void> => {
    try {
      const { url } = req.body;
      
      console.log(`[Diagnostics] Anonymous scan triggered - URL: ${url}`);
      
      if (!url) {
        res.status(400).json({ error: 'url is required' });
        return;
      }
      
      // Validate URL format
      try {
        new URL(url);
      } catch {
        res.status(400).json({ error: 'Invalid URL format' });
        return;
      }
      
      // Anonymous scan options with strict server-managed limits
      const anonymousOptions = {
        auditType: 'quick' as const,
        includeSitemap: false,
        maxPages: 3, // Server-managed limit for anonymous scans
        storeRawData: false,
        skipCache: true // Always fresh for anonymous scans
      };
      
      // Run anonymous diagnostic scan
      const result = await this.diagnosticsService.runAnonymousDiagnostic(url, anonymousOptions);
      
      if (result.status === 'failed') {
        res.status(500).json({
          error: 'Diagnostic scan failed',
          details: result.error
        });
        return;
      }
      
      const responseData = {
        message: 'Anonymous diagnostic scan completed',
        status: result.status,
        duration: result.duration,
        result: result.result
      };

      // Log diagnostic data for debugging
      console.log('\n=== ANONYMOUS DIAGNOSTIC RESPONSE ===');
      console.log(`URL: ${url}`);
      console.log(`Overall Score: ${result.result?.overall.score_0_100}/100 (${result.result?.overall.raw_0_1})`);
      console.log(`Site Profile: ${result.result?.site.category}`);
      console.log('\nCategory Scores:');
      if (result.result?.categories) {
        Object.entries(result.result.categories).forEach(([category, data]) => {
          console.log(`  ${category}: ${Math.round((data as any).score * 100)}% (${data.indicators?.length || 0} indicators)`);
        });
      }
      console.log(`Duration: ${result.duration}ms`);
      console.log('=====================================\n');

      res.status(200).json(responseData);
      
    } catch (error) {
      console.error('Error running anonymous diagnostic scan:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  /**
   * POST /v1/diagnostics/scan
   * Trigger a new diagnostic scan
   */
  triggerScan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { siteId, options = {} } = req.body;
      const userId = req.user?.id;
      
      console.log(`[Diagnostics] Scan triggered - User: ${userId}, Site: ${siteId}`);
      
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      if (!siteId) {
        res.status(400).json({ error: 'siteId is required' });
        return;
      }
      
      // Validate site ownership
      const site = await this.prisma.site.findFirst({
        where: { id: siteId, user_id: userId }
      });
      
      if (!site) {
        res.status(404).json({ error: 'Site not found or access denied' });
        return;
      }
      
      // Check subscription tier for advanced features
      const runOptions: RunDiagnosticOptions = {
        auditType: options.auditType || 'full',
        includeSitemap: this.hasProAccess(req.user?.subscription_tier) ? options.includeSitemap : false,
        maxPages: this.getMaxPages(req.user?.subscription_tier, options.maxPages),
        storeRawData: this.hasProAccess(req.user?.subscription_tier) ? options.storeRawData : false,
        skipCache: options.skipCache || false
      };
      
      // Start diagnostic scan
      const result = await this.diagnosticsService.runDiagnostic(userId, siteId, runOptions);
      
      if (result.status === 'failed') {
        res.status(500).json({
          error: 'Diagnostic scan failed',
          details: result.error,
          auditId: result.auditId
        });
        return;
      }
      
      res.status(200).json({
        message: 'Diagnostic scan completed',
        auditId: result.auditId,
        status: result.status,
        duration: result.duration,
        result: result.result
      });
      
    } catch (error) {
      console.error('Error triggering diagnostic scan:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  /**
   * GET /v1/diagnostics/sites/:siteId/score
   * Get latest site score and summary
   */
  getSiteScore = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { siteId } = req.params;
      const userId = req.user?.id;
      
      console.log(`[Diagnostics] Score requested - User: ${userId}, Site: ${siteId}`);
      
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const result = await this.diagnosticsService.getLatestDiagnostic(userId, siteId);
      
      if (!result) {
        res.status(404).json({ 
          error: 'No diagnostic results found for this site',
          message: 'Run a diagnostic scan first'
        });
        return;
      }
      
      // Return spec-compliant data with tier-based access
      const responseData = this.hasProAccess(req.user?.subscription_tier) 
        ? {
            // Full spec-compliant report for pro users
            ...result,
            auditId: siteId // Add audit context
          }
        : {
            // Simplified data for free tier
            site: result.site,
            overall: result.overall,
            categories: {
              discovery: { score: result.categories.discovery.score },
              understanding: { score: result.categories.understanding.score },
              actions: { score: result.categories.actions.score },
              trust: { score: result.categories.trust.score }
            },
            auditId: siteId
          };
      
      res.status(200).json(responseData);
      
    } catch (error) {
      console.error('Error getting site score:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  /**
   * GET /v1/diagnostics/pages/:pageId/indicators
   * Get detailed page-level indicators (Pro only)
   */
  getPageIndicators = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { pageId } = req.params;
      const { category, status, limit = '50', offset = '0' } = req.query;
      const userId = req.user?.id;
      
      console.log(`[Diagnostics] Page indicators requested - User: ${userId}, Page: ${pageId}`);
      
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      if (!this.hasProAccess(req.user?.subscription_tier)) {
        res.status(403).json({ 
          error: 'Pro subscription required',
          message: 'Page-level indicator details are available with Pro subscription'
        });
        return;
      }
      
      // Build query filters
      const where: any = {
        page_id: pageId,
        audit: {
          user_id: userId
        }
      };
      
      if (category) where.category = category;
      if (status) where.status = status;
      
      const indicators = await this.prisma.diagnosticIndicator.findMany({
        where,
        include: {
          audit: {
            include: {
              site: true
            }
          }
        },
        orderBy: [
          { weight: 'desc' },
          { status: 'asc' }
        ],
        take: Math.min(parseInt(limit as string), 100),
        skip: parseInt(offset as string)
      });
      
      const total = await this.prisma.diagnosticIndicator.count({ where });
      
      res.status(200).json({
        indicators: indicators.map(indicator => ({
          id: indicator.id,
          indicatorName: indicator.indicator_name,
          category: indicator.category,
          status: indicator.status,
          score: indicator.score,
          weight: indicator.weight,
          message: indicator.message,
          recommendation: indicator.recommendation,
          details: indicator.details ? JSON.parse(indicator.details as string) : null,
          checkedUrl: indicator.checked_url,
          found: indicator.found,
          isValid: indicator.is_valid,
          scannedAt: indicator.scanned_at
        })),
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: parseInt(offset as string) + parseInt(limit as string) < total
        }
      });
      
    } catch (error) {
      console.error('Error getting page indicators:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  /**
   * POST /v1/diagnostics/trigger-rescore
   * Trigger on-demand rescore (Pro only)
   */
  triggerRescore = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { siteId } = req.body;
      const userId = req.user?.id;
      
      console.log(`[Diagnostics] Rescore triggered - User: ${userId}, Site: ${siteId}`);
      
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      if (!this.hasProAccess(req.user?.subscription_tier)) {
        res.status(403).json({ 
          error: 'Pro subscription required',
          message: 'On-demand rescoring is available with Pro subscription'
        });
        return;
      }
      
      if (!siteId) {
        res.status(400).json({ error: 'siteId is required' });
        return;
      }
      
      // Trigger rescore with skipCache option
      const result = await this.diagnosticsService.runDiagnostic(userId, siteId, {
        auditType: 'on_demand',
        skipCache: true,
        includeSitemap: true,
        storeRawData: true
      });
      
      res.status(200).json({
        message: 'Rescore completed',
        auditId: result.auditId,
        status: result.status,
        duration: result.duration
      });
      
    } catch (error) {
      console.error('Error triggering rescore:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  /**
   * GET /v1/diagnostics/audits/:auditId
   * Get specific audit details
   */
  getAuditDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { auditId } = req.params;
      const userId = req.user?.id;
      
      console.log(`[Diagnostics] Audit details requested - User: ${userId}, Audit: ${auditId}`);
      
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const audit = await this.prisma.diagnosticAudit.findFirst({
        where: {
          id: auditId,
          user_id: userId
        },
        include: {
          site: true,
          pages: {
            include: {
              indicators: true
            }
          },
          scores: true
        }
      });
      
      if (!audit) {
        res.status(404).json({ error: 'Audit not found or access denied' });
        return;
      }
      
      res.status(200).json({
        id: audit.id,
        siteId: audit.site_id,
        siteName: audit.site.name,
        siteUrl: audit.site.url,
        auditType: audit.audit_type,
        status: audit.status,
        siteScore: audit.site_score,
        aiReadiness: audit.ai_readiness,
        accessIntent: audit.access_intent,
        startedAt: audit.started_at,
        completedAt: audit.completed_at,
        errorMessage: audit.error_message,
        pages: audit.pages.map(page => ({
          id: page.id,
          url: page.url,
          title: page.title,
          pageScore: page.page_score,
          indicatorCount: page.indicators.length
        })),
        categoryScores: audit.scores.filter(s => s.score_type === 'category')
      });
      
    } catch (error) {
      console.error('Error getting audit details:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  private hasProAccess(subscriptionTier?: string): boolean {
    return subscriptionTier === 'pro' || subscriptionTier === 'enterprise';
  }
  
  private getMaxPages(subscriptionTier?: string, requestedPages?: number): number {
    const maxPages = this.hasProAccess(subscriptionTier) ? 20 : 5;
    return Math.min(requestedPages || maxPages, maxPages);
  }
}