import { BaseScanner, ScannerContext, ScannerResult, IndicatorCategory } from './base';
import { fetchUrl, buildUrl } from './base/scanner.utils';

/**
 * Scanner for Model Context Protocol (MCP) detection
 * Checks for /.well-known/mcp.json endpoint
 */
export class McpScanner extends BaseScanner {
  name = 'mcp';
  category: IndicatorCategory = 'standards';
  description = 'Detects Model Context Protocol (MCP) configuration for AI agent actions';
  weight = 2.5; // High weight for action-enabling capability
  
  async scan(context: ScannerContext): Promise<ScannerResult> {
    const mcpUrl = buildUrl(context.siteUrl, '/.well-known/mcp.json');
    
    try {
      const result = await fetchUrl(mcpUrl);
      
      if (!result.found) {
        return this.createResult({
          status: 'fail',
          score: 0.0,
          message: 'No MCP configuration found at /.well-known/mcp.json',
          details: {
            statusCode: result.statusCode,
            contentFound: false,
            validationIssues: ['MCP configuration file not found'],
            specificData: {
              checkedUrl: mcpUrl,
              hasMcp: false
            },
            aiOptimizationOpportunities: [
              'Implement MCP configuration to enable AI agent actions',
              'Add /.well-known/mcp.json endpoint for advanced AI integrations'
            ]
          },
          recommendation: 'Implement Model Context Protocol (MCP) configuration at /.well-known/mcp.json to enable AI agents to perform actions on your site',
          checkedUrl: mcpUrl,
          found: false,
          isValid: false
        });
      }
      
      // Validate MCP JSON structure
      const validation = this.validateMcpConfig(result.content || '');
      
      if (!validation.isValid) {
        return this.createResult({
          status: 'warn',
          score: 0.5,
          message: 'MCP configuration found but has validation issues',
          details: {
            statusCode: result.statusCode,
            contentFound: true,
            contentPreview: result.content?.substring(0, 200),
            validationIssues: validation.issues,
            validationScore: 0.5,
            specificData: {
              checkedUrl: mcpUrl,
              hasMcp: true,
              mcpConfig: validation.parsedConfig,
              capabilities: validation.capabilities
            },
            aiReadinessFactors: [
              'MCP endpoint exists',
              'Partial MCP configuration available'
            ],
            aiOptimizationOpportunities: validation.issues.map(issue => `Fix: ${issue}`)
          },
          recommendation: `Fix MCP configuration issues: ${validation.issues.join('; ')}`,
          checkedUrl: mcpUrl,
          found: true,
          isValid: false
        });
      }
      
      // Valid MCP configuration
      return this.createResult({
        status: 'pass',
        score: 1.0,
        message: 'Valid MCP configuration enables AI agent actions',
        details: {
          statusCode: result.statusCode,
          contentFound: true,
          contentPreview: result.content?.substring(0, 200),
          validationScore: 1.0,
          specificData: {
            checkedUrl: mcpUrl,
            hasMcp: true,
            mcpConfig: validation.parsedConfig,
            capabilities: validation.capabilities,
            actionCount: validation.actionCount,
            authRequired: validation.authRequired
          },
          aiReadinessFactors: [
            'Valid MCP configuration present',
            `${validation.actionCount} actions available for AI agents`,
            validation.authRequired ? 'Authentication configured' : 'Public actions available'
          ]
        },
        checkedUrl: mcpUrl,
        found: true,
        isValid: true
      });
      
    } catch (error) {
      return this.createResult({
        status: 'fail',
        score: 0.0,
        message: `Error checking MCP configuration: ${error}`,
        details: {
          error: String(error),
          contentFound: false,
          specificData: {
            checkedUrl: mcpUrl,
            hasMcp: false
          }
        },
        recommendation: 'Ensure MCP endpoint is accessible and returns valid JSON',
        checkedUrl: mcpUrl,
        found: false,
        isValid: false
      });
    }
  }
  
  private validateMcpConfig(content: string): {
    isValid: boolean;
    issues: string[];
    parsedConfig: any;
    capabilities: string[];
    actionCount: number;
    authRequired: boolean;
  } {
    const issues: string[] = [];
    let parsedConfig: any = null;
    let capabilities: string[] = [];
    let actionCount = 0;
    let authRequired = false;
    
    try {
      parsedConfig = JSON.parse(content);
    } catch (e) {
      issues.push('Invalid JSON format');
      return {
        isValid: false,
        issues,
        parsedConfig: null,
        capabilities: [],
        actionCount: 0,
        authRequired: false
      };
    }
    
    // Validate required fields
    if (!parsedConfig.version) {
      issues.push('Missing required field: version');
    }
    
    if (!parsedConfig.capabilities || !Array.isArray(parsedConfig.capabilities)) {
      issues.push('Missing or invalid capabilities array');
    } else {
      capabilities = parsedConfig.capabilities;
      
      // Check for actions
      if (parsedConfig.actions && Array.isArray(parsedConfig.actions)) {
        actionCount = parsedConfig.actions.length;
        
        // Validate action structure
        parsedConfig.actions.forEach((action: any, index: number) => {
          if (!action.name) {
            issues.push(`Action ${index} missing name`);
          }
          if (!action.description) {
            issues.push(`Action ${index} missing description`);
          }
          if (!action.parameters) {
            issues.push(`Action ${index} missing parameters`);
          }
        });
      }
    }
    
    // Check authentication
    if (parsedConfig.authentication) {
      authRequired = true;
      
      if (!parsedConfig.authentication.type) {
        issues.push('Authentication specified but type is missing');
      }
    }
    
    // Check for server information
    if (!parsedConfig.server) {
      issues.push('Missing server configuration');
    } else {
      if (!parsedConfig.server.url) {
        issues.push('Missing server URL');
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      parsedConfig,
      capabilities,
      actionCount,
      authRequired
    };
  }
}