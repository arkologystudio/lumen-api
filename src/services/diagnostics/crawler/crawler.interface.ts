export interface CrawlOptions {
  userAgent?: string;
  timeout?: number;
  viewport?: {
    width: number;
    height: number;
  };
  waitFor?: {
    selector?: string;
    timeout?: number;
    networkIdle?: boolean;
  };
  screenshot?: boolean;
  fullPageScreenshot?: boolean;
}

export interface CrawlResult {
  url: string;
  html: string;
  statusCode: number;
  headers: Record<string, string>;
  loadTimeMs: number;
  title?: string;
  metaDescription?: string;
  wordCount?: number;
  screenshotPath?: string;
  error?: string;
  redirectChain?: string[];
  finalUrl?: string;
}

export interface ICrawler {
  crawl(url: string, options?: CrawlOptions): Promise<CrawlResult>;
  crawlMultiple(urls: string[], options?: CrawlOptions): Promise<CrawlResult[]>;
  close(): Promise<void>;
}

export interface CrawlerConfig {
  maxConcurrent?: number;
  defaultTimeout?: number;
  defaultUserAgent?: string;
  enableScreenshots?: boolean;
  storageBasePath?: string;
}