import { BaseScanner, ScannerContext, ScannerResult, IndicatorCategory } from './base';
import { fetchUrl, buildUrl, validateJsonSchema } from './base/scanner.utils';


export class AgentJsonScanner extends BaseScanner {
  name = 'agent_json';
  category: IndicatorCategory = 'standards';
  description = 'Checks for the presence and validity of agent.json file for AI agent configuration';
  weight = 1.5;
  
  async scan(context: ScannerContext): Promise<ScannerResult> {
    const agentJsonUrl = buildUrl(context.siteUrl, '/agent.json');
    const result = await fetchUrl(agentJsonUrl);
    
    if (!result.found) {
      return this.createResult({
        status: 'fail',
        score: 0.0,
        message: 'No agent.json file found',
        details: {
          error: result.error,
          statusCode: result.statusCode
        },
        recommendation: 'Create an agent.json file at the root of your website to define AI agent capabilities',
        checkedUrl: agentJsonUrl,
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
        score: 0.0,
        message: 'Invalid JSON in agent.json file',
        details: {
          error: error.message,
          content: result.content
        },
        recommendation: 'Fix the JSON syntax errors in your agent.json file',
        checkedUrl: agentJsonUrl,
        found: true,
        isValid: false
      });
    }
    
    // Validate schema
    const validation = this.validateAgentJson(parsedJson);
    
    if (!validation.isValid) {
      return this.createResult({
        status: 'warn',
        score: 0.5,
        message: 'agent.json file found but missing recommended fields',
        details: {
          missingFields: validation.missingFields,
          warnings: validation.warnings,
          content: parsedJson
        },
        recommendation: `Add the following fields to your agent.json: ${validation.missingFields.join(', ')}`,
        checkedUrl: agentJsonUrl,
        found: true,
        isValid: false
      });
    }
    
    return this.createResult({
      status: 'pass',
      score: 1.0,
      message: 'Valid agent.json file found',
      details: {
        content: parsedJson,
        capabilities: parsedJson.capabilities?.length || 0,
        hasApi: !!parsedJson.api
      },
      checkedUrl: agentJsonUrl,
      found: true,
      isValid: true
    });
  }
  
  private validateAgentJson(data: any): {
    isValid: boolean;
    missingFields: string[];
    warnings: string[];
  } {
    const requiredFields = ['name', 'description'];
    const recommendedFields = ['version', 'capabilities', 'contact'];
    
    const validation = validateJsonSchema(data, requiredFields);
    const warnings: string[] = [];
    
    // Check recommended fields
    for (const field of recommendedFields) {
      if (!(field in data)) {
        warnings.push(`Recommended field '${field}' is missing`);
      }
    }
    
    // Validate specific field formats
    if (data.capabilities && !Array.isArray(data.capabilities)) {
      warnings.push('capabilities should be an array');
    }
    
    if (data.contact && typeof data.contact !== 'object') {
      warnings.push('contact should be an object');
    }
    
    if (data.api?.endpoints && !Array.isArray(data.api.endpoints)) {
      warnings.push('api.endpoints should be an array');
    }
    
    return {
      isValid: validation.isValid,
      missingFields: validation.missingFields,
      warnings
    };
  }
}