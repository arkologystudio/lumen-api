import { ICrawler, CrawlResult, CrawlOptions } from './crawler.interface';
import { HttpCrawler } from './httpCrawler';
import { createClient } from '@supabase/supabase-js';
import { URL } from 'url';

export interface CrawlerServiceConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  storageBucket?: string;
  crawler?: ICrawler;
}

export interface SiteCrawlOptions extends CrawlOptions {
  includeSitemap?: boolean;
  maxPages?: number;
  storeRawData?: boolean;
}

export interface SiteCrawlResult {
  siteUrl: string;
  pages: CrawlResult[];
  sitemapUrls?: string[];
  robotsTxt?: {
    found: boolean;
    content?: string;
  };
  totalPages: number;
  errors: string[];
  duration: number;
}

export class CrawlerService {
  private crawler: ICrawler;
  private supabase: any;
  private config: CrawlerServiceConfig;
  
  constructor(config: CrawlerServiceConfig) {
    this.config = config;
    this.crawler = config.crawler || new HttpCrawler({
      enableScreenshots: false,
      maxConcurrent: 3
    });
    
    if (config.supabaseUrl && config.supabaseKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    }
  }
  
  async crawlSite(siteUrl: string, options: SiteCrawlOptions = {}): Promise<SiteCrawlResult> {
    const startTime = Date.now();
    const result: SiteCrawlResult = {
      siteUrl,
      pages: [],
      totalPages: 0,
      errors: [],
      duration: 0
    };
    
    try {
      // Normalize site URL
      const normalizedUrl = this.normalizeSiteUrl(siteUrl);
      
      // Start with homepage
      const urlsToCrawl = [normalizedUrl];
      
      // Add robots.txt check
      const robotsResult = await this.checkRobotsTxt(normalizedUrl);
      result.robotsTxt = robotsResult;
      
      if (robotsResult.found && options.includeSitemap) {
        const sitemapUrls = this.extractSitemapUrls(robotsResult.content || '');
        result.sitemapUrls = sitemapUrls;
        
        // For now, just crawl the homepage unless we implement sitemap parsing
      }
      
      // Limit pages to crawl
      const maxPages = options.maxPages || 5;
      const pagesToCrawl = urlsToCrawl.slice(0, maxPages);
      
      // Crawl pages
      const crawlResults = await this.crawler.crawlMultiple(pagesToCrawl, options);
      result.pages = crawlResults;
      result.totalPages = crawlResults.length;
      
      // Store raw data if requested
      if (options.storeRawData && this.supabase) {
        await this.storeRawData(result);
      }
      
      // Collect errors
      result.errors = crawlResults
        .filter(page => page.error)
        .map(page => `${page.url}: ${page.error}`);
      
    } catch (error) {
      result.errors.push(`Site crawl failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      result.duration = Date.now() - startTime;
    }
    
    return result;
  }
  
  async crawlSinglePage(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
    return await this.crawler.crawl(url, options);
  }
  
  private normalizeSiteUrl(url: string): string {
    try {
      const parsed = new URL(url);
      
      // Ensure HTTPS if no protocol specified
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        parsed.protocol = 'https:';
      }
      
      // Remove trailing slash
      if (parsed.pathname === '/') {
        parsed.pathname = '';
      }
      
      return parsed.toString();
    } catch {
      // If URL parsing fails, prepend https://
      return url.startsWith('http') ? url : `https://${url}`;
    }
  }
  
  private async checkRobotsTxt(siteUrl: string): Promise<{ found: boolean; content?: string }> {
    try {
      const robotsUrl = new URL('/robots.txt', siteUrl).toString();
      const result = await this.crawler.crawl(robotsUrl, { timeout: 10000 });
      
      return {
        found: result.statusCode === 200 && !!result.html,
        content: result.statusCode === 200 ? result.html : undefined
      };
    } catch {
      return { found: false };
    }
  }
  
  private extractSitemapUrls(robotsContent: string): string[] {
    const sitemapUrls: string[] = [];
    const lines = robotsContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('sitemap:')) {
        const url = trimmed.substring(8).trim();
        if (url) {
          sitemapUrls.push(url);
        }
      }
    }
    
    return sitemapUrls;
  }
  
  private async storeRawData(result: SiteCrawlResult): Promise<void> {
    if (!this.supabase || !this.config.storageBucket) return;
    
    const timestamp = new Date().toISOString();
    const siteHost = new URL(result.siteUrl).hostname;
    
    for (const page of result.pages) {
      if (page.html && page.statusCode === 200) {
        const fileName = this.generateFileName(page.url, 'html', timestamp);
        const filePath = `${siteHost}/${fileName}`;
        
        try {
          await this.supabase.storage
            .from(this.config.storageBucket)
            .upload(filePath, page.html, {
              contentType: 'text/html',
              upsert: true
            });
        } catch (error) {
          console.error(`Failed to store HTML for ${page.url}:`, error);
        }
      }
    }
  }
  
  private generateFileName(url: string, type: 'html' | 'screenshot', timestamp: string): string {
    const urlObj = new URL(url);
    const pathName = urlObj.pathname === '/' ? 'index' : urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '_');
    const timeStr = timestamp.replace(/[^0-9]/g, '');
    
    return `${pathName}_${timeStr}.${type === 'html' ? 'html' : 'png'}`;
  }
  
  async close(): Promise<void> {
    await this.crawler.close();
  }
}