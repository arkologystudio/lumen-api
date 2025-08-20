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
    
    // If profile is explicitly declared (except 'custom'), use it
    if (declaredProfile && this.isValidProfile(declaredProfile) && declaredProfile !== 'custom') {
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
    if (jsonLdIndicator?.details?.schemas || jsonLdIndicator?.details?.specificData?.schemas) {
      const schemas = (jsonLdIndicator.details.schemas || jsonLdIndicator.details.specificData?.schemas) as string[];
      
      // Enhanced e-commerce signals
      const ecommerceSchemas = ['Product', 'Offer', 'ShoppingCart', 'Store', 'OnlineStore', 'ProductModel', 'Brand', 'Review', 'AggregateRating'];
      const ecommerceSchemaMatches = schemas.filter(s => ecommerceSchemas.includes(s));
      if (ecommerceSchemaMatches.length > 0) {
        profileScores.ecommerce += Math.min(4, ecommerceSchemaMatches.length); // Cap at 4
        signals.push(`E-commerce schemas detected: ${ecommerceSchemaMatches.join(', ')}`);
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
      
      // Enhanced e-commerce URL patterns
      const ecommerceUrlPatterns = [
        '/cart', '/checkout', '/products', '/shop', '/store', 
        '/product/', '/wc-api/', '/woocommerce', '/add-to-cart',
        '/my-account', '/basket', '/order', '/payment', '/billing'
      ];
      const urlMatches = ecommerceUrlPatterns.filter(pattern => urlLower.includes(pattern));
      if (urlMatches.length > 0) {
        profileScores.ecommerce += Math.min(2, urlMatches.length); // Cap at 2
        signals.push(`E-commerce URL patterns: ${urlMatches.join(', ')}`);
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
      const urlObj = new URL(url);
      if (urlObj.hostname.endsWith('.gov') || urlLower.includes('/policy') || 
          urlLower.includes('/regulations')) {
        profileScores.gov_nontransacting += 1;
        signals.push('Government URL patterns');
      }
    });
    
    // Check meta tags and SEO indicators
    const seoIndicator = indicators.find(i => i.indicatorName === 'seo_basic');
    if (seoIndicator?.details) {
      // Handle both legacy and new format
      const title = (seoIndicator.details.title || 
        (seoIndicator.details.specificData?.title?.exists ? seoIndicator.details.specificData.title.title : '') || '').toLowerCase();
      const description = (seoIndicator.details.metaDescription || 
        (seoIndicator.details.specificData?.metaDescription?.exists ? seoIndicator.details.specificData.metaDescription.metaDescription : '') || '').toLowerCase();
      
      // Enhanced e-commerce keywords detection
      const ecommerceKeywords = [
        'shop', 'store', 'buy', 'purchase', 'cart', 'checkout', 'online store', 
        'add to cart', 'buy now', 'sale', 'price', 'product', 'products', 'organic', 'artisan', 'gourmet',
        'shipping', 'delivery', 'free shipping', 'quality', 'handmade', 'natural',
        'basket', 'wishlist', 'account', 'sign up', 'sign in', 'register', 'login',
        'logout', 'my account', 'track order', 'returns', 'refund', 'payment', 'secure checkout',
        'discount', 'coupon', 'promo code', 'deal', 'clearance', 'bestseller', 'featured products',
        'in stock', 'out of stock', 'inventory', 'new arrivals', 'add to wishlist',
        'customer reviews', 'ratings', 'guarantee', 'secure payment', 'credit card', 'paypal',
        'stripe', 'klarna', 'afterpay', 'apple pay', 'google pay', 'gift card', 'gift voucher',
        'subscribe & save', 'loyalty', 'rewards', 'free returns', 'express shipping',
        'fast delivery', 'next day delivery', 'same day delivery', 'international shipping',
        'wholesale', 'bulk order', 'minimum order', 'quantity', 'SKU', 'category', 'categories',
        'brands', 'brand', 'collection', 'collections', 'flash sale', 'limited time', 'pre-order',
        'backorder', 'bundle', 'combo', 'multi-buy', 'save', 'exclusive', 'deal of the day',
        'outlet', 'online exclusive', 'shop now', 'view cart', 'continue shopping', 'proceed to checkout',
        'order summary', 'order confirmation', 'invoice', 'billing', 'shipping address', 'delivery address',
       'returns policy'
      ];
      const ecommerceMatches = ecommerceKeywords.filter(keyword => 
        title.includes(keyword) || description.includes(keyword)
      );
      if (ecommerceMatches.length > 0) {
        profileScores.ecommerce += Math.min(4, ecommerceMatches.length); // Increased cap to 4
        signals.push(`E-commerce keywords in SEO: ${ecommerceMatches.join(', ')}`);
      }
      
      // Check for blog keywords
      const blogKeywords = ['blog', 'article', 'read', 'post', 'news', 'stories'];
      const blogMatches = blogKeywords.filter(keyword => 
        title.includes(keyword) || description.includes(keyword)
      );
      if (blogMatches.length > 0) {
        profileScores.blog_content += Math.min(2, blogMatches.length);
        signals.push(`Blog keywords in SEO: ${blogMatches.join(', ')}`);
      }
      
      // Check for support keywords
      const supportKeywords = ['help', 'support', 'documentation', 'guide', 'faq', 'tutorial'];
      const supportMatches = supportKeywords.filter(keyword => 
        title.includes(keyword) || description.includes(keyword)
      );
      if (supportMatches.length > 0) {
        profileScores.kb_support += Math.min(2, supportMatches.length);
        signals.push(`Support keywords in SEO: ${supportMatches.join(', ')}`);
      }
      
      // Check navigation/menu content for e-commerce indicators
      if (seoIndicator.details.specificData?.navigation) {
        const nav = seoIndicator.details.specificData.navigation;
        const allNavText = [...(nav.menuItems || []), ...(nav.linkTexts || [])].join(' ').toLowerCase();
        
        const navEcommerceKeywords = ['shop', 'store', 'products', 'catalogue', 'catalog', 'buy', 'order online', 'cart', 'checkout', 'add to cart'];
        const navMatches = navEcommerceKeywords.filter(keyword => allNavText.includes(keyword));
        if (navMatches.length > 0) {
          profileScores.ecommerce += Math.min(3, navMatches.length); // Cap at 3
          signals.push(`E-commerce navigation detected: ${navMatches.join(', ')}`);
        }
        
        // Also check headings as fallback
        if (seoIndicator.details.specificData?.headings?.structure) {
          const headingsText = seoIndicator.details.specificData.headings.structure.join(' ').toLowerCase();
          const headingMatches = navEcommerceKeywords.filter(keyword => headingsText.includes(keyword));
          if (headingMatches.length > 0) {
            profileScores.ecommerce += 1;
            signals.push(`E-commerce headings detected: ${headingMatches.join(', ')}`);
          }
        }
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