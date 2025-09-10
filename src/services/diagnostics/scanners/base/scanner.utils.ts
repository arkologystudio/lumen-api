import axios from 'axios';
import { URL } from 'url';

export interface FetchResult {
  found: boolean;
  statusCode?: number;
  content?: string;
  headers?: Record<string, string>;
  error?: string;
}

export async function fetchUrl(url: string, timeout: number = 5000): Promise<FetchResult> {
  try {
    const response = await axios.get(url, {
      timeout,
      maxRedirects: 5,
      validateStatus: () => true, // Don't throw on any status
      headers: {
        'User-Agent': 'Lighthouse Diagnostics Scanner/1.0'
      }
    });
    
    return {
      found: response.status >= 200 && response.status < 300,
      statusCode: response.status,
      content: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
      headers: response.headers as Record<string, string>
    };
  } catch (error: any) {
    return {
      found: false,
      error: error.message || String(error)
    };
  }
}

export function buildUrl(baseUrl: string, path: string): string {
  try {
    const base = new URL(baseUrl);
    const url = new URL(path, base);
    
    // Only allow http and https protocols for security
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`Invalid protocol: ${url.protocol}`);
    }
    
    return url.toString();
  } catch (error: any) {
    throw new Error(`Invalid URL: ${error.message || String(error)}`);
  }
}

export function extractMetaTags(html: string): Record<string, string> {
  const metaTags: Record<string, string> = {};
  
  // Extract regular meta tags
  const metaRegex = /<meta\s+(?:name|property)=["']([^"']+)["']\s+content=["']([^"']*?)["']/gi;
  let match;
  
  while ((match = metaRegex.exec(html)) !== null) {
    metaTags[match[1]] = match[2];
  }
  
  // Extract title
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  if (titleMatch) {
    metaTags.title = titleMatch[1].trim();
  }
  
  return metaTags;
}

export function extractJsonLd(html: string): any[] {
  const jsonLdScripts: any[] = [];
  const scriptRegex = /<script\s+type=["']application\/ld\+json["']>([^<]+)<\/script>/gi;
  let match;
  
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const jsonData = JSON.parse(match[1].trim());
      jsonLdScripts.push(jsonData);
    } catch (error: any) {
      // Invalid JSON-LD, skip
    }
  }
  
  return jsonLdScripts;
}

export function extractRobotsMeta(html: string): {
  noindex?: boolean;
  nofollow?: boolean;
  noai?: boolean;
  noimageai?: boolean;
} {
  const robots: any = {};
  const metaTags = extractMetaTags(html);
  
  const robotsContent = metaTags['robots'] || '';
  const aiContent = metaTags['robots-ai'] || '';
  
  // Standard robots directives (case-insensitive)
  robots.noindex = robotsContent.toLowerCase().includes('noindex');
  robots.nofollow = robotsContent.toLowerCase().includes('nofollow');
  
  // AI-specific directives (case-insensitive)
  robots.noai = robotsContent.toLowerCase().includes('noai') || aiContent.toLowerCase().includes('noai');
  robots.noimageai = robotsContent.toLowerCase().includes('noimageai') || aiContent.toLowerCase().includes('noimageai');
  
  return robots;
}

export function validateJsonSchema(data: any, requiredFields: string[]): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    if (!(field in data)) {
      missingFields.push(field);
    }
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

export function parseRobotsTxt(content: string): {
  userAgents: Record<string, any>;
  sitemaps: string[];
  crawlDelay?: number;
} {
  const lines = content.split('\n').map(line => line.trim());
  const result: any = {
    userAgents: {},
    sitemaps: []
  };
  
  let currentUserAgent = '*';
  
  for (const line of lines) {
    if (line.startsWith('#') || !line) continue;
    
    const [directive, ...valueParts] = line.split(':').map(part => part.trim());
    const value = valueParts.join(':').trim();
    
    switch (directive.toLowerCase()) {
      case 'user-agent':
        currentUserAgent = value;
        if (!result.userAgents[currentUserAgent]) {
          result.userAgents[currentUserAgent] = {
            disallow: [],
            allow: []
          };
        }
        break;
        
      case 'disallow':
        if (value && result.userAgents[currentUserAgent]) {
          result.userAgents[currentUserAgent].disallow.push(value);
        }
        break;
        
      case 'allow':
        if (value && result.userAgents[currentUserAgent]) {
          result.userAgents[currentUserAgent].allow.push(value);
        }
        break;
        
      case 'sitemap':
        if (value) {
          result.sitemaps.push(value);
        }
        break;
        
      case 'crawl-delay':
        result.crawlDelay = parseInt(value, 10);
        break;
    }
  }
  
  return result;
}