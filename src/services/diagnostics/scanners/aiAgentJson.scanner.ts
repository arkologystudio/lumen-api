import { BaseScanner, ScannerContext, ScannerResult, IndicatorCategory } from './base';
import { fetchUrl, buildUrl, validateJsonSchema } from './base/scanner.utils';

interface AiAgentJsonSchema {
  version?: string;
  name?: string;
  description?: string;
  capabilities?: {
    search?: boolean;
    chat?: boolean;
    actions?: string[];
  };
  authentication?: {
    type?: string;
    instructions?: string;
  };
  privacy?: {
    dataUsage?: string;
    userTracking?: boolean;
  };
  rateLimit?: {
    requests?: number;
    period?: string;
  };
}

export class AiAgentJsonScanner extends BaseScanner {
  name = 'ai_agent_json';
  category: IndicatorCategory = 'standards';
  description = 'Checks for .well-known/ai-agent.json file following emerging AI standards';
  weight = 2.0;
  
  async scan(context: ScannerContext): Promise<ScannerResult> {
    const aiAgentJsonUrl = buildUrl(context.siteUrl, '/.well-known/ai-agent.json');
    const result = await fetchUrl(aiAgentJsonUrl);
    
    if (!result.found) {
      return this.createResult({
        status: 'warn',
        score: 3,
        message: 'No .well-known/ai-agent.json file found',
        details: {
          error: result.error,
          statusCode: result.statusCode
        },
        recommendation: 'Consider creating a .well-known/ai-agent.json file to comply with emerging AI agent standards',
        checkedUrl: aiAgentJsonUrl,
        found: false,
        isValid: false
      });
    }
    
    // Parse and validate JSON
    let parsedJson: any;
    try {
      parsedJson = JSON.parse(result.content || '{}');
    } catch (error: any) {
      return this.createResult({
        status: 'fail',
        score: 0,
        message: 'Invalid JSON in .well-known/ai-agent.json file',
        details: {
          error: error.message,
          content: result.content
        },
        recommendation: 'Fix the JSON syntax errors in your .well-known/ai-agent.json file',
        checkedUrl: aiAgentJsonUrl,
        found: true,
        isValid: false
      });
    }
    
    // Validate schema
    const validation = this.validateAiAgentJson(parsedJson);
    
    if (!validation.isValid) {
      return this.createResult({
        status: 'warn',
        score: 6,
        message: '.well-known/ai-agent.json found but incomplete',
        details: {
          missingFields: validation.missingFields,
          warnings: validation.warnings,
          content: parsedJson
        },
        recommendation: `Enhance your AI agent configuration by adding: ${validation.missingFields.join(', ')}`,
        checkedUrl: aiAgentJsonUrl,
        found: true,
        isValid: false
      });
    }
    
    // Check for advanced features
    const hasAdvancedFeatures = this.checkAdvancedFeatures(parsedJson);
    
    return this.createResult({
      status: 'pass',
      score: hasAdvancedFeatures ? 10 : 8,
      message: hasAdvancedFeatures 
        ? 'Comprehensive .well-known/ai-agent.json configuration found'
        : 'Valid .well-known/ai-agent.json file found',
      details: {
        content: parsedJson,
        hasCapabilities: !!parsedJson.capabilities,
        hasAuthentication: !!parsedJson.authentication,
        hasPrivacy: !!parsedJson.privacy,
        hasRateLimit: !!parsedJson.rateLimit,
        advancedFeatures: hasAdvancedFeatures
      },
      checkedUrl: aiAgentJsonUrl,
      found: true,
      isValid: true
    });
  }
  
  private validateAiAgentJson(data: any): {
    isValid: boolean;
    missingFields: string[];
    warnings: string[];
  } {
    const requiredFields = ['version', 'name', 'description'];
    const recommendedFields = ['capabilities', 'privacy'];
    
    const validation = validateJsonSchema(data, requiredFields);
    const warnings: string[] = [];
    
    // Check recommended fields
    for (const field of recommendedFields) {
      if (!(field in data)) {
        warnings.push(`Recommended field '${field}' is missing`);
      }
    }
    
    // Validate specific structures
    if (data.capabilities && typeof data.capabilities !== 'object') {
      warnings.push('capabilities should be an object');
    }
    
    if (data.authentication && !data.authentication.type) {
      warnings.push('authentication.type is required when authentication is specified');
    }
    
    if (data.rateLimit) {
      if (!data.rateLimit.requests || !data.rateLimit.period) {
        warnings.push('rateLimit should specify both requests and period');
      }
    }
    
    return {
      isValid: validation.isValid,
      missingFields: validation.missingFields,
      warnings
    };
  }
  
  private checkAdvancedFeatures(data: AiAgentJsonSchema): boolean {
    const advancedFeatures = [
      data.capabilities && Object.keys(data.capabilities).length > 2,
      data.authentication && data.authentication.type,
      data.privacy && data.privacy.dataUsage,
      data.rateLimit && data.rateLimit.requests
    ];
    
    return advancedFeatures.filter(Boolean).length >= 3;
  }
}