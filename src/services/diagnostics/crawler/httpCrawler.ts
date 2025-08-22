import axios, { AxiosResponse } from 'axios';
import { JSDOM } from 'jsdom';
import { ICrawler, CrawlOptions, CrawlResult, CrawlerConfig } from './crawler.interface';

export class HttpCrawler implements ICrawler {
  private config: CrawlerConfig;
  
  constructor(config: CrawlerConfig = {}) {
    this.config = {
      maxConcurrent: 5,
      defaultTimeout: 30000,
      defaultUserAgent: 'Lighthouse Diagnostics Crawler/1.0',
      enableScreenshots: false,
      ...config
    };
  }
  
  async crawl(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
    const startTime = Date.now();
    
    try {
      const response = await this.fetchPage(url, options);
      const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Extract basic metadata
      const title = document.querySelector('title')?.textContent?.trim();
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim();
      const wordCount = this.calculateWordCount(document.body?.textContent || '');
      
      return {
        url,
        html,
        statusCode: response.status,
        headers: response.headers as Record<string, string>,
        loadTimeMs: Date.now() - startTime,
        title,
        metaDescription,
        wordCount,
        finalUrl: response.request?.responseURL || url,
        redirectChain: this.extractRedirectChain(response)
      };
    } catch (error: any) {
      return {
        url,
        html: '',
        statusCode: error.response?.status || 0,
        headers: error.response?.headers || {},
        loadTimeMs: Date.now() - startTime,
        error: error.message || String(error)
      };
    }
  }
  
  async crawlMultiple(urls: string[], options: CrawlOptions = {}): Promise<CrawlResult[]> {
    const results: CrawlResult[] = [];
    const maxConcurrent = this.config.maxConcurrent || 5;
    
    // Process in batches to respect concurrency limits
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(url => this.crawl(url, options));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }
  
  async close(): Promise<void> {
    // HTTP crawler doesn't need cleanup
  }
  
  private async fetchPage(url: string, options: CrawlOptions): Promise<AxiosResponse> {
    const config = {
      timeout: options.timeout || this.config.defaultTimeout,
      maxRedirects: 5,
      validateStatus: () => true, // Don't throw on any status
      headers: {
        'User-Agent': options.userAgent || this.config.defaultUserAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    };
    
    return await axios.get(url, config);
  }
  
  private calculateWordCount(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
  
  private extractRedirectChain(response: AxiosResponse): string[] {
    const chain: string[] = [];
    
    // Axios doesn't provide full redirect chain, but we can check final URL
    if (response.request?.responseURL && response.request.responseURL !== response.config.url) {
      chain.push(response.config.url!);
      chain.push(response.request.responseURL);
    }
    
    return chain;
  }
}