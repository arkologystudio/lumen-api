# Diagnostics API Frontend Specification v2.0

## Overview

The Lumen Diagnostics API provides comprehensive website analysis for AI readiness, SEO optimization, and content accessibility. This specification details the enhanced response structure designed to provide rich, actionable information for frontend applications.

## API Endpoints

### Anonymous Scan (Public)
```
POST /v1/diagnostics/scan-url
Content-Type: application/json

{
  "url": "https://example.com"
}
```

### Authenticated Scan (Registered Users)
```
POST /v1/diagnostics/scan
Authorization: Bearer <token>
Content-Type: application/json

{
  "siteId": "site-uuid",
  "options": {
    "auditType": "quick" | "full",
    "maxPages": 3
  }
}
```

## Enhanced Response Structure

### Main Response Object

```typescript
interface DiagnosticResponse {
  message: string;
  status: 'completed' | 'failed' | 'partial';
  duration: number; // milliseconds
  result: AggregatedResult;
}

interface AggregatedResult {
  auditId: string;
  siteUrl: string;
  auditType: 'full' | 'quick' | 'scheduled' | 'on_demand';
  
  // Enhanced page data
  pages: PageAggregation[];
  
  // Enhanced scoring
  siteScore: SiteScore;
  categoryScores: CategoryScore[];
  
  // Enhanced summary
  summary: AuditSummary;
  
  // AI-specific insights
  aiReadiness: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  aiReadinessDetails: AiReadinessDetails;
  accessIntent: 'allow' | 'partial' | 'block';
  accessIntentDetails: AccessIntentDetails;
  
  // Metadata
  scanMetadata: ScanMetadata;
}
```

## Individual Indicators

Each page now includes detailed indicator results for the 8 core indicators:

### IndicatorResult Structure

```typescript
interface IndicatorResult {
  // Core identifier
  name: string;                    // e.g., "llms_txt"
  displayName: string;             // e.g., "LLMS.txt File"
  description: string;             // Human-readable description
  category: IndicatorCategory;     // 'standards' | 'seo' | 'structured_data' | etc.
  
  // Status and scoring
  status: 'pass' | 'warn' | 'fail' | 'not_applicable';
  score: number;                   // 0-10
  weight: number;                  // Importance multiplier
  maxScore: number;                // Always 10 for normalization
  
  // User-facing messaging
  message: string;                 // Status message
  recommendation?: string;         // Actionable advice
  
  // Technical details
  checkedUrl?: string;            // URL that was analyzed
  found: boolean;                 // Whether the resource was found
  isValid: boolean;               // Whether it passed validation
  
  // Rich details for UI
  details: IndicatorDetails;      // Structured data specific to indicator
  
  // Performance context
  scannedAt: Date;               // When this indicator was checked
}
```

### The 8 Core Indicators

| Indicator Name | Display Name | Category | Description |
|---------------|--------------|----------|-------------|
| `llms_txt` | LLMS.txt File | standards | AI agent instruction file validation |
| `agent_json` | Agent Configuration | standards | Root-level agent configuration |
| `ai_agent_json` | AI Agent Configuration | standards | Well-known directory agent config |
| `robots_txt` | Robots.txt | seo | Robots.txt and meta robots directives |
| `canonical_urls` | Canonical URLs | seo | Canonical URL validation |
| `sitemap_xml` | XML Sitemap | seo | XML sitemap detection and validation |
| `seo_basic` | Basic SEO | seo | Basic SEO indicators (title, meta description) |
| `json_ld` | JSON-LD Structured Data | structured_data | JSON-LD structured data analysis |

## Frontend Implementation Guide

### 1. Dashboard Overview
```typescript
// Display high-level metrics
const { siteScore, aiReadiness, summary } = result;

// Show completion percentage
const completionRate = summary.completionPercentage;

// Display AI readiness with details
const { aiReadinessDetails } = result;
```

### 2. Individual Indicator Cards
```typescript
// Loop through indicators for detailed view
result.pages[0].indicators.forEach(indicator => {
  // Show indicator status with visual indicator
  const statusColor = {
    'pass': 'green',
    'warn': 'yellow',
    'fail': 'red',
    'not_applicable': 'gray'
  }[indicator.status];
  
  // Display score out of 10
  const scorePercentage = (indicator.score / indicator.maxScore) * 100;
  
  // Show actionable recommendations
  if (indicator.recommendation) {
    // Display recommendation with estimated impact/difficulty
  }
});
```

### 3. Action Items Prioritization
```typescript
// Display prioritized recommendations
result.summary.quickWins.forEach(item => {
  // Show items that are easy to implement
});

result.summary.strategicImprovements.forEach(item => {
  // Show items for long-term planning
});
```

## Error Handling

### Error Response Structure
```typescript
interface ErrorResponse {
  error: string;
  details?: string;
  code?: number;
}
```

### Common Error Scenarios
- **400 Bad Request**: Invalid URL format or missing parameters
- **401 Unauthorized**: Authentication required for registered user features
- **429 Too Many Requests**: Rate limiting exceeded
- **500 Internal Server Error**: Server-side processing error

## Rate Limiting

- **Anonymous scans**: 10 requests per hour per IP
- **Authenticated scans**: 100 requests per hour per user
- **Free tier**: Limited to 3 pages per scan
- **Paid tier**: Up to 50 pages per scan