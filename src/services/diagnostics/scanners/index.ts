export * from './base';
export * from './llmsTxt.scanner';
export * from './agentJson.scanner';

export * from './robots.scanner';
export * from './canonical.scanner';
export * from './sitemap.scanner';
export * from './seoBasic.scanner';
export * from './jsonLd.scanner';

import { ScannerRegistry } from './base';
import { LlmsTxtScanner } from './llmsTxt.scanner';
import { AgentJsonScanner } from './agentJson.scanner';

import { RobotsScanner } from './robots.scanner';
import { CanonicalScanner } from './canonical.scanner';
import { SitemapScanner } from './sitemap.scanner';
import { SeoBasicScanner } from './seoBasic.scanner';
import { JsonLdScanner } from './jsonLd.scanner';

// Initialize and register all scanners
export function initializeScanners(): ScannerRegistry {
  const registry = ScannerRegistry.getInstance();
  
  // Clear any existing scanners
  registry.clear();
  
  // Register AI standards scanners
  registry.register(new LlmsTxtScanner());
  registry.register(new AgentJsonScanner());
  
  // Register SEO/standards scanners
  registry.register(new RobotsScanner());
  registry.register(new CanonicalScanner());
  registry.register(new SitemapScanner());
  registry.register(new SeoBasicScanner());
  
  // Register structured data scanners
  registry.register(new JsonLdScanner());
  
  return registry;
}