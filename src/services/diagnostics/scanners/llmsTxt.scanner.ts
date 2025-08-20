import { BaseScanner, ScannerContext, ScannerResult, IndicatorCategory } from './base';
import { fetchUrl, buildUrl } from './base/scanner.utils';

interface LlmsTxtContent {
  title?: string;
  summary?: string;
  sections?: { [key: string]: Array<{ title: string; url: string; description?: string }> };
  hasValidStructure?: boolean;
  [key: string]: any;
}

export class LlmsTxtScanner extends BaseScanner {
  name = 'llms_txt';
  category: IndicatorCategory = 'standards';
  description = 'Checks for the presence and validity of llms.txt file for AI agent instructions';
  weight = 2.0; // Higher weight as it's a key AI-readiness indicator
  
  async scan(context: ScannerContext): Promise<ScannerResult> {
    const llmsTxtUrl = buildUrl(context.siteUrl, '/llms.txt');
    const result = await fetchUrl(llmsTxtUrl);
    
    if (!result.found) {
          return this.createResult({
      status: 'fail',
      score: 0.0,
      message: 'No llms.txt file found',
      details: {
        statusCode: result.statusCode,
        error: result.error,
        contentFound: false,
        contentPreview: undefined,
        validationIssues: ['File not found at /llms.txt'],
        specificData: {
          checkedPaths: ['/llms.txt'],
          expectedFormat: 'Markdown file with H1 title, blockquote summary, and H2 sections with links',
          examples: [
            '# Project Name',
            '> Brief project summary',
            '## Documentation',
            '- [Getting Started](url): Description'
          ]
        },
        aiReadinessFactors: [],
        aiOptimizationOpportunities: [
          'Implement llms.txt file to provide AI agents with structured content overview',
          'Create clear sections organizing your key documentation and resources',
          'Include descriptive links to help AI understand your content structure'
        ]
      },
      recommendation: 'Create an llms.txt file at the root of your website to provide AI agents with a structured overview of your content',
      checkedUrl: llmsTxtUrl,
      found: false,
      isValid: false
    });
    }
    
    // Parse and validate llms.txt content
    const validation = this.validateLlmsTxt(result.content || '');
    
    if (!validation.isValid) {
      return this.createResult({
        status: 'warn',
        score: 0.5,
        message: 'llms.txt file found but has issues',
        details: {
          statusCode: 200,
          contentFound: true,
          contentPreview: result.content?.substring(0, 200) + (result.content && result.content.length > 200 ? '...' : ''),
          validationIssues: validation.issues,
          validationScore: 0.5,
          specificData: {
            parsedContent: validation.parsedContent,
            sectionCount: validation.sectionCount,
            detectedSections: Object.keys(validation.parsedContent.sections || {}),
            contentLength: result.content?.length || 0,
            hasTitle: !!validation.parsedContent.title,
            hasSummary: !!validation.parsedContent.summary
          },
          aiReadinessFactors: [
            'File exists but has validation issues',
            'Partial AI agent compatibility'
          ],
          aiOptimizationOpportunities: [
            'Fix validation issues to improve AI content understanding',
            'Add missing required Markdown structure elements',
            'Ensure proper Markdown formatting and syntax'
          ]
        },
        recommendation: 'Fix the issues in your llms.txt file to ensure proper AI content understanding',
        checkedUrl: llmsTxtUrl,
        found: true,
        isValid: false
      });
    }
    
    return this.createResult({
      status: 'pass',
      score: 1.0,
      message: 'Valid llms.txt file found',
      details: {
        statusCode: 200,
        contentFound: true,
        contentPreview: result.content?.substring(0, 200) + (result.content && result.content.length > 200 ? '...' : ''),
        validationScore: 1.0,
                  specificData: {
            parsedContent: validation.parsedContent,
            sectionCount: validation.sectionCount,
            detectedSections: Object.keys(validation.parsedContent.sections || {}),
            contentLength: result.content?.length || 0,
            hasTitle: !!validation.parsedContent.title,
            hasSummary: !!validation.parsedContent.summary,
            linkCount: Object.values(validation.parsedContent.sections || {}).flat().length
          },
        aiReadinessFactors: [
          'Valid llms.txt file provides structured content overview',
          'Proper Markdown formatting detected',
          'AI-friendly content organization established'
        ],
        aiOptimizationOpportunities: [
          'Well-configured for AI content understanding',
          'Consider adding more structured sections as your content grows'
        ]
      },
      checkedUrl: llmsTxtUrl,
      found: true,
      isValid: true
    });
  }
  
  private validateLlmsTxt(content: string): {
    isValid: boolean;
    issues: string[];
    parsedContent: LlmsTxtContent;
    sectionCount: number;
  } {
    const issues: string[] = [];
    const parsedContent: LlmsTxtContent = { sections: {} };
    let sectionCount = 0;
    
    if (!content.trim()) {
      issues.push('File is empty');
      return { isValid: false, issues, parsedContent, sectionCount };
    }
    
    const lines = content.split('\n');
    let hasTitle = false;
    let hasSummary = false;
    let currentSection: string | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;
      
      // Skip empty lines
      if (!line) continue;
      
      // Check for H1 title (only the first one counts)
      if (line.startsWith('# ') && !hasTitle) {
        parsedContent.title = line.substring(2).trim();
        hasTitle = true;
        continue;
      }
      
      // Check for blockquote summary
      if (line.startsWith('> ')) {
        if (!parsedContent.summary) {
          parsedContent.summary = line.substring(2).trim();
        } else {
          // Append to existing summary
          parsedContent.summary += ' ' + line.substring(2).trim();
        }
        hasSummary = true;
        continue;
      }
      
      // Check for H2 sections
      if (line.startsWith('## ')) {
        currentSection = line.substring(3).trim();
        if (currentSection && !parsedContent.sections![currentSection]) {
          parsedContent.sections![currentSection] = [];
          sectionCount++;
        }
        continue;
      }
      
      // Check for markdown links in sections
      if (currentSection && line.startsWith('- [')) {
        const linkMatch = line.match(/^- \[([^\]]+)\]\(([^)]+)\)(?::\s*(.*))?/);
        if (linkMatch) {
          const [, title, url, description] = linkMatch;
          parsedContent.sections![currentSection].push({
            title: title.trim(),
            url: url.trim(),
            description: description?.trim()
          });
        } else {
          // Invalid link format
          issues.push(`Line ${lineNumber}: Invalid markdown link format`);
        }
        continue;
      }
      
      // For content that isn't a title, summary, section header, or link, 
      // we're more permissive since llms.txt can contain additional markdown content
      // We only flag obvious structural issues
    }
    
    // Validation checks based on llms.txt specification
    if (!hasTitle) {
      issues.push('Missing required H1 title (should start with "# ")');
    }
    
    // Summary is recommended but not strictly required in some implementations
    // Many valid llms.txt files organize content in sections without blockquote summaries
    if (!hasSummary && sectionCount === 0) {
      issues.push('Consider adding a blockquote summary (starting with "> ") to provide context');
    }
    
    parsedContent.hasValidStructure = hasTitle && (sectionCount > 0 || hasSummary);
    
    return {
      isValid: issues.length === 0 && hasTitle,
      issues,
      parsedContent,
      sectionCount
    };
  }
}