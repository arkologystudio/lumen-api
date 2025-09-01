import { SiteProfile } from './profileDetector';

export type ApplicabilityStatus = 'required' | 'optional' | 'not_applicable';

export interface Applicability {
  status: ApplicabilityStatus;
  reason: string;
  included_in_category_math: boolean;
}

export type IndicatorName = 
  | 'mcp'
  | 'agents_json'
  | 'llms_txt'
  | 'json_ld'
  | 'sitemap_xml'
  | 'canonical_urls'
  | 'robots_txt'
  | 'seo_basic';

// Map our indicator names to spec indicator names
export const INDICATOR_NAME_MAP: Record<string, IndicatorName> = {
  'mcp': 'mcp',
  'agent_json': 'agents_json',
  'llms_txt': 'llms_txt',
  'json_ld': 'json_ld',
  'sitemap_xml': 'sitemap_xml',
  'canonical_urls': 'canonical_urls',
  'robots_txt': 'robots_txt',
  'seo_basic': 'seo_basic'
};

export class ApplicabilityMatrix {
  // Applicability matrix from the specification
  private readonly matrix: Record<IndicatorName, Record<SiteProfile, ApplicabilityStatus>> = {
    mcp: {
      blog_content: 'not_applicable',
      ecommerce: 'required',
      saas_app: 'required',
      kb_support: 'optional',
      gov_nontransacting: 'not_applicable',
      custom: 'optional'
    },
    agents_json: {
      blog_content: 'optional',
      ecommerce: 'required',
      saas_app: 'required',
      kb_support: 'optional',
      gov_nontransacting: 'optional',
      custom: 'optional'
    },
    llms_txt: {
      blog_content: 'required',
      ecommerce: 'required',
      saas_app: 'required',
      kb_support: 'required',
      gov_nontransacting: 'required',
      custom: 'required'
    },
    json_ld: {
      blog_content: 'required',
      ecommerce: 'required',
      saas_app: 'required',
      kb_support: 'required',
      gov_nontransacting: 'required',
      custom: 'required'
    },
    sitemap_xml: {
      blog_content: 'required',
      ecommerce: 'required',
      saas_app: 'required',
      kb_support: 'required',
      gov_nontransacting: 'required',
      custom: 'required'
    },
    canonical_urls: {
      blog_content: 'required',
      ecommerce: 'required',
      saas_app: 'required',
      kb_support: 'required',
      gov_nontransacting: 'required',
      custom: 'required'
    },
    robots_txt: {
      blog_content: 'required',
      ecommerce: 'required',
      saas_app: 'required',
      kb_support: 'required',
      gov_nontransacting: 'required',
      custom: 'required'
    },
    seo_basic: {
      blog_content: 'required',
      ecommerce: 'required',
      saas_app: 'required',
      kb_support: 'required',
      gov_nontransacting: 'required',
      custom: 'required'
    }
  };

  
  /**
   * Get applicability for an indicator based on site profile
   */
  getApplicability(indicatorName: string, profile: SiteProfile): Applicability {
    // Map internal indicator name to spec name
    const specIndicatorName = INDICATOR_NAME_MAP[indicatorName] || indicatorName as IndicatorName;
    
    // Get status from matrix, default to optional if not found
    const status = this.matrix[specIndicatorName]?.[profile] || 'optional';
    
    // Determine if included in category math
    const included_in_category_math = status !== 'not_applicable';
    
    // Generate reason
    const reason = this.generateReason(specIndicatorName, profile, status);
    
    return {
      status,
      reason,
      included_in_category_math
    };
  }
  
  /**
   * Get all applicabilities for a given profile
   */
  getProfileApplicabilities(profile: SiteProfile): Record<string, Applicability> {
    const result: Record<string, Applicability> = {};
    
    for (const [indicatorName] of Object.entries(this.matrix)) {
      result[indicatorName] = this.getApplicability(indicatorName, profile);
    }
    
    return result;
  }
  
  /**
   * Check if an indicator should be included in scoring for a profile
   */
  shouldIncludeInScoring(indicatorName: string, profile: SiteProfile): boolean {
    const applicability = this.getApplicability(indicatorName, profile);
    return applicability.included_in_category_math;
  }
  
  private generateReason(indicatorName: IndicatorName, profile: SiteProfile, status: ApplicabilityStatus): string {
    const profileDisplay = this.getProfileDisplayName(profile);
    
    switch (status) {
      case 'required':
        return `${indicatorName} is required for ${profileDisplay}`;
      case 'optional':
        return `${indicatorName} is recommended but optional for ${profileDisplay}`;
      case 'not_applicable':
        return `${indicatorName} is not applicable to ${profileDisplay}`;
      default:
        return `${indicatorName} applicability determined for ${profileDisplay}`;
    }
  }
  
  private getProfileDisplayName(profile: SiteProfile): string {
    const names: Record<SiteProfile, string> = {
      blog_content: 'blog/content sites',
      ecommerce: 'e-commerce sites',
      saas_app: 'SaaS applications',
      kb_support: 'knowledge base/support sites',
      gov_nontransacting: 'government (non-transacting) sites',
      custom: 'custom sites'
    };
    
    return names[profile] || 'unknown site type';
  }
  
  /**
   * Get indicator categories that affect each spec category
   */
  getCategoryMapping(): Record<string, string[]> {
    return {
      discovery: ['robots_txt', 'sitemap_xml', 'seo_basic'],
      understanding: ['json_ld', 'llms_txt', 'canonical_urls'],
      actions: ['mcp', 'agents_json'],
      trust: ['canonical_urls', 'robots_txt']
    };
  }
}