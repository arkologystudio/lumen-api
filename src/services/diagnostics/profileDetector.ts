import { ScannerResult } from './scanners/base';

export type SiteProfile = 
  | 'blog_content'
  | 'ecommerce'
  | 'saas_app'
  | 'kb_support'
  | 'gov_nontransacting'
  | 'custom';

export interface ProfileDetectionResult {
  profile: SiteProfile;
  confidence: number;
  signals: string[];
  method: 'heuristic' | 'declared';
}

export class SiteProfileDetector {
  
  /**
   * Detect site profile based on heuristics or client declaration
   */
  detectProfile(
    indicators: ScannerResult[], 
    pageUrls: string[],
    declaredProfile?: SiteProfile
  ): ProfileDetectionResult {
    
    // If profile is explicitly declared, use it
    if (declaredProfile && this.isValidProfile(declaredProfile)) {
      return {
        profile: declaredProfile,
        confidence: 1.0,
        signals: ['Client declared profile'],
        method: 'declared'
      };
    }
    
    // Otherwise, detect using heuristics
    return this.detectProfileFromHeuristics(indicators, pageUrls);
  }
  
  private detectProfileFromHeuristics(
    indicators: ScannerResult[], 
    pageUrls: string[]
  ): ProfileDetectionResult {
    const signals: string[] = [];
    const profileScores: Record<SiteProfile, number> = {
      blog_content: 0,
      ecommerce: 0,
      saas_app: 0,
      kb_support: 0,
      gov_nontransacting: 0,
      custom: 0
    };
    
    // Check JSON-LD structured data
    const jsonLdIndicator = indicators.find(i => i.indicatorName === 'json_ld');
    if (jsonLdIndicator?.details?.schemas) {
      const schemas = jsonLdIndicator.details.schemas as string[];
      
      // E-commerce signals
      if (schemas.some(s => ['Product', 'Offer', 'ShoppingCart'].includes(s))) {
        profileScores.ecommerce += 3;
        signals.push('Product/Offer schema detected');
      }
      
      // Blog/content signals
      if (schemas.some(s => ['Article', 'BlogPosting', 'NewsArticle'].includes(s))) {
        profileScores.blog_content += 3;
        signals.push('Article/Blog schema detected');
      }
      
      // Knowledge base signals
      if (schemas.some(s => ['FAQPage', 'HowTo', 'QAPage'].includes(s))) {
        profileScores.kb_support += 3;
        signals.push('FAQ/HowTo schema detected');
      }
      
      // Government signals
      if (schemas.some(s => ['GovernmentOrganization', 'GovernmentService'].includes(s))) {
        profileScores.gov_nontransacting += 3;
        signals.push('Government schema detected');
      }
    }
    
    // Check URL patterns
    pageUrls.forEach(url => {
      const urlLower = url.toLowerCase();
      
      // E-commerce URL patterns
      if (urlLower.includes('/cart') || urlLower.includes('/checkout') || 
          urlLower.includes('/products') || urlLower.includes('/shop')) {
        profileScores.ecommerce += 1;
        signals.push('E-commerce URL patterns');
      }
      
      // SaaS app patterns
      if (urlLower.includes('/api') || urlLower.includes('/dashboard') || 
          urlLower.includes('/login') || urlLower.includes('/oauth')) {
        profileScores.saas_app += 1;
        signals.push('SaaS app URL patterns');
      }
      
      // Knowledge base patterns
      if (urlLower.includes('/docs') || urlLower.includes('/help') || 
          urlLower.includes('/support') || urlLower.includes('/faq')) {
        profileScores.kb_support += 1;
        signals.push('Knowledge base URL patterns');
      }
      
      // Blog patterns
      if (urlLower.includes('/blog') || urlLower.includes('/post') || 
          urlLower.includes('/article') || urlLower.includes('/news')) {
        profileScores.blog_content += 1;
        signals.push('Blog/content URL patterns');
      }
      
      // Government patterns
      if (urlLower.includes('.gov') || urlLower.includes('/policy') || 
          urlLower.includes('/regulations')) {
        profileScores.gov_nontransacting += 1;
        signals.push('Government URL patterns');
      }
    });
    
    // Check meta tags and SEO indicators
    const seoIndicator = indicators.find(i => i.indicatorName === 'seo_basic');
    if (seoIndicator?.details) {
      const title = (seoIndicator.details.title || '').toLowerCase();
      const description = (seoIndicator.details.metaDescription || '').toLowerCase();
      
      // Check for e-commerce keywords
      if (title.includes('shop') || title.includes('store') || 
          description.includes('buy') || description.includes('purchase')) {
        profileScores.ecommerce += 1;
        signals.push('E-commerce keywords in SEO');
      }
      
      // Check for blog keywords
      if (title.includes('blog') || title.includes('article') || 
          description.includes('read') || description.includes('post')) {
        profileScores.blog_content += 1;
        signals.push('Blog keywords in SEO');
      }
      
      // Check for support keywords
      if (title.includes('help') || title.includes('support') || 
          description.includes('documentation') || description.includes('guide')) {
        profileScores.kb_support += 1;
        signals.push('Support keywords in SEO');
      }
    }
    
    // Find the profile with highest score
    let maxScore = 0;
    let detectedProfile: SiteProfile = 'custom';
    
    for (const [profile, score] of Object.entries(profileScores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedProfile = profile as SiteProfile;
      }
    }
    
    // If no clear signals, default to custom
    if (maxScore === 0) {
      detectedProfile = 'custom';
      signals.push('No clear profile signals detected');
    }
    
    // Calculate confidence based on signal strength
    const confidence = Math.min(1.0, maxScore / 5); // Normalize to 0-1
    
    return {
      profile: detectedProfile,
      confidence,
      signals,
      method: 'heuristic'
    };
  }
  
  private isValidProfile(profile: string): profile is SiteProfile {
    const validProfiles: SiteProfile[] = [
      'blog_content',
      'ecommerce',
      'saas_app',
      'kb_support',
      'gov_nontransacting',
      'custom'
    ];
    
    return validProfiles.includes(profile as SiteProfile);
  }
  
  /**
   * Get human-readable profile name
   */
  getProfileDisplayName(profile: SiteProfile): string {
    const names: Record<SiteProfile, string> = {
      blog_content: 'Blog/Content Site',
      ecommerce: 'E-commerce Site',
      saas_app: 'SaaS Application',
      kb_support: 'Knowledge Base/Support',
      gov_nontransacting: 'Government (Non-transacting)',
      custom: 'Custom/Other'
    };
    
    return names[profile] || 'Unknown';
  }
}