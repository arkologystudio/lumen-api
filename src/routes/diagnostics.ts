import { Router } from 'express';
import { DiagnosticsController } from '../controllers/diagnosticsController';
import { authenticateUser } from '../middleware/auth';
import { trackQuery } from '../middleware/queryTracking';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function createDiagnosticsRoutes(): Router {
  const router = Router();
  const diagnosticsController = new DiagnosticsController(prisma);
  
  /**
   * POST /v1/diagnostics/scan-url
   * Run anonymous diagnostic scan on any URL (no authentication required)
   * 
   * Body:
   * - url: string (required) - The website URL to scan
   * 
   * Returns basic diagnostic results without storing to database
   * Limited to 3 pages for anonymous scans
   */
  router.post('/scan-url', diagnosticsController.scanUrl);
  
  // Apply authentication to authenticated routes
  router.use(authenticateUser);
  
  // Apply query tracking for usage monitoring
  router.use(trackQuery);
  
  /**
   * POST /v1/diagnostics/scan
   * Trigger a new diagnostic scan for a site
   * 
   * Body:
   * - siteId: string (required)
   * - options: object (optional)
   *   - auditType: 'full' | 'quick' | 'scheduled' | 'on_demand'
   *   - includeSitemap: boolean (Pro only)
   *   - maxPages: number (limited by subscription)
   *   - storeRawData: boolean (Pro only)
   *   - skipCache: boolean
   */
  router.post('/scan', diagnosticsController.triggerScan);
  
  /**
   * GET /v1/diagnostics/sites/:siteId/score
   * Get the latest diagnostic score for a site
   * 
   * Returns:
   * - siteScore: overall score and breakdown
   * - aiReadiness: 'excellent' | 'good' | 'needs_improvement' | 'poor'
   * - accessIntent: 'allow' | 'partial' | 'block'
   * - summary: indicator counts and top issues/recommendations
   * - categoryScores: scores by category (Pro only)
   */
  router.get('/sites/:siteId/score', diagnosticsController.getSiteScore);
  
  /**
   * GET /v1/diagnostics/pages/:pageId/indicators
   * Get detailed indicators for a specific page (Pro only)
   * 
   * Query params:
   * - category: filter by category
   * - status: filter by status ('pass', 'warn', 'fail')
   * - limit: number of results (max 100)
   * - offset: pagination offset
   */
  router.get('/pages/:pageId/indicators', diagnosticsController.getPageIndicators);
  
  /**
   * POST /v1/diagnostics/trigger-rescore
   * Trigger an on-demand rescore bypassing cache (Pro only)
   * 
   * Body:
   * - siteId: string (required)
   */
  router.post('/trigger-rescore', diagnosticsController.triggerRescore);
  
  /**
   * GET /v1/diagnostics/audits/:auditId
   * Get details for a specific audit
   * 
   * Returns:
   * - audit metadata
   * - site information
   * - page summaries
   * - category scores
   */
  router.get('/audits/:auditId', diagnosticsController.getAuditDetails);
  
  return router;
}

export default createDiagnosticsRoutes;