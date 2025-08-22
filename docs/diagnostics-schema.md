# Diagnostics Report Schema Documentation

## Overview

The Lumen API diagnostics system provides comprehensive AI-readiness assessments for websites following the LighthouseAI specification. This document defines the exact payload schema for all diagnostics-related API responses.

## Core Report Structure

### `LighthouseAIReport`

The main diagnostic report object returned by all scan endpoints.

```typescript
{
  "site": {
    "url": string,              // The scanned URL (e.g., "https://example.com")
    "scan_date": string,        // ISO 8601 timestamp (e.g., "2025-01-19T10:30:00Z")
    "category": string          // Site profile: "blog_content" | "ecommerce" | "saas_app" | "kb_support" | "gov_nontransacting" | "custom"
  },
  "categories": {
    "discovery": {
      "score": number,          // 0.0 to 1.0
      "indicators": [...]       // Array of SpecIndicator objects
    },
    "understanding": {
      "score": number,          // 0.0 to 1.0
      "indicators": [...]       // Array of SpecIndicator objects
    },
    "actions": {
      "score": number,          // 0.0 to 1.0
      "indicators": [...]       // Array of SpecIndicator objects
    },
    "trust": {
      "score": number,          // 0.0 to 1.0
      "indicators": [...]       // Array of SpecIndicator objects
    }
  },
  "weights": {
    "discovery": number,        // Default: 0.30
    "understanding": number,    // Default: 0.30
    "actions": number,          // Default: 0.25
    "trust": number            // Default: 0.15
  },
  "overall": {
    "raw_0_1": number,         // Raw score from 0.0 to 1.0
    "score_0_100": number      // Percentage score from 0 to 100
  }
}
```

### `SpecIndicator`

Individual indicator within each category.

```typescript
{
  "name": string,              // Indicator identifier (e.g., "robots_txt", "sitemap_xml")
  "score": number,             // 0.0 to 1.0
  "applicability": {
    "status": string,          // "required" | "optional" | "not_applicable"
    "reason": string,          // Human-readable explanation
    "included_in_category_math": boolean  // Whether this indicator affects category score
  },
  "evidence": {                // Optional detailed scanner results
    "status": string,          // "pass" | "warn" | "fail" | "not_applicable"
    "message": string,         // Human-readable status message
    "details": {
      "statusCode": number,    // HTTP response code (optional)
      "contentFound": boolean, // Whether expected content was found
      "contentPreview": string,// Preview of found content (optional)
      "validationIssues": string[], // Array of validation issues (optional)
      "validationScore": number,    // Validation score 0-100 (optional)
      "specificData": {},      // Scanner-specific data (varies by indicator)
      "aiReadinessFactors": string[],     // AI optimization factors
      "aiOptimizationOpportunities": string[] // Improvement suggestions
    },
    "found": boolean,          // Whether the resource was found
    "isValid": boolean,        // Whether the resource is valid
    "checkedUrl": string       // The URL that was checked
  }
}
```

## API Endpoint Responses

### 1. Anonymous Scan: `POST /v1/diagnostics/scan-url`

**Request Body:**
```json
{
  "url": "https://example.com",
  "siteProfile": "blog_content"  // Optional, defaults to "custom"
}
```

**Response:**
```json
{
  "message": "Anonymous diagnostic scan completed",
  "status": "completed",        // "completed" | "failed" | "partial"
  "duration": 5432,             // Milliseconds
  "result": {
    // Full LighthouseAIReport object
  }
}
```

### 2. Authenticated Scan: `POST /v1/diagnostics/scan`

**Request Body:**
```json
{
  "siteId": "site_123456",
  "pageUrl": "https://example.com/page",
  "siteProfile": "ecommerce"    // Optional
}
```

**Response:**
```json
{
  "message": "Diagnostic scan completed",
  "auditId": "audit_789abc",
  "status": "completed",        // "completed" | "failed" | "partial"
  "duration": 6789,
  "result": {
    // Full LighthouseAIReport object
  }
}
```

### 3. Get Site Score: `GET /v1/diagnostics/sites/:siteId/score`

**Response for Pro Users (Full Report):**
```json
{
  "auditId": "audit_123xyz",
  "site": {
    "url": "https://example.com",
    "scan_date": "2025-01-19T10:30:00Z",
    "category": "ecommerce"
  },
  "categories": {
    // Full category objects with indicators
  },
  "weights": {
    // Weight values
  },
  "overall": {
    "raw_0_1": 0.875,
    "score_0_100": 87.5
  }
}
```

**Response for Free Tier Users (Simplified):**
```json
{
  "auditId": "audit_123xyz",
  "site": {
    "url": "https://example.com",
    "scan_date": "2025-01-19T10:30:00Z",
    "category": "ecommerce"
  },
  "categories": {
    "discovery": { "score": 0.85 },
    "understanding": { "score": 0.90 },
    "actions": { "score": 0.75 },
    "trust": { "score": 0.95 }
  },
  "overall": {
    "raw_0_1": 0.875,
    "score_0_100": 87.5
  }
}
```

### 4. Get Page Indicators: `GET /v1/diagnostics/pages/:pageId/indicators`

**Query Parameters:**
- `limit`: number (default: 20, max: 100)
- `offset`: number (default: 0)
- `category`: string (optional, filter by category)
- `status`: string (optional, filter by status)

**Response:**
```json
{
  "indicators": [
    {
      "id": "ind_abc123",
      "indicatorName": "robots_txt",
      "category": "discovery",
      "status": "pass",
      "score": 1.0,
      "weight": 0.30,
      "message": "Robots.txt file found and properly configured",
      "recommendation": "Continue maintaining your robots.txt file",
      "details": {
        "statusCode": 200,
        "contentFound": true,
        "contentPreview": "User-agent: *\nAllow: /",
        "aiReadinessFactors": ["Allows AI crawlers", "No blocking of essential paths"]
      },
      "checkedUrl": "https://example.com/robots.txt",
      "found": true,
      "isValid": true,
      "scannedAt": "2025-01-19T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 8,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

## Scanner Types and Indicators

### Discovery Category Scanners
- **robots_txt**: Analyzes robots.txt file and meta robots tags
- **sitemap_xml**: Validates XML sitemap presence and structure
- **seo_basic**: Checks basic SEO elements (title, meta description, headings)

### Understanding Category Scanners
- **json_ld**: Validates JSON-LD structured data
- **llms_txt**: Checks for /llms.txt file (AI instructions)
- **canonical_urls**: Validates canonical URL implementation

### Actions Category Scanners
- **mcp**: Model Context Protocol implementation
- **agent_json**: Checks for /agent.json file (AI agent configuration)

### Trust Category Scanners
- **canonical_urls**: Ensures content authenticity
- **robots_txt**: Proper crawler directives
- **seo_basic**: Content quality signals

## Score Calculation

### Category Score Formula
```
category_score = Σ(indicator_score × indicator_applicability_weight) / Σ(indicator_applicability_weight)
```

Where indicators with `included_in_category_math: false` are excluded.

### Overall Score Formula
```
overall_raw = (discovery_score × 0.30) + (understanding_score × 0.30) + 
              (actions_score × 0.25) + (trust_score × 0.15)

overall_percentage = overall_raw × 100
```

## Status Values

### Scan Status
- `completed`: All scanners executed successfully
- `partial`: Some scanners completed, others failed
- `failed`: Critical failure, no useful data collected

### Indicator Status
- `pass`: Indicator fully meets requirements (score ≥ 0.8)
- `warn`: Partial compliance (0.4 ≤ score < 0.8)
- `fail`: Does not meet requirements (score < 0.4)
- `not_applicable`: Not relevant for this site profile

### Applicability Status
- `required`: Essential for this site profile
- `optional`: Beneficial but not critical
- `not_applicable`: Not relevant for this site profile

## Site Profiles

Available site profiles that affect indicator applicability:

- `blog_content`: Content-focused blog or news site
- `ecommerce`: Online store with products
- `saas_app`: Software as a Service application
- `kb_support`: Knowledge base or support documentation
- `gov_nontransacting`: Government information site
- `custom`: Default profile with all indicators optional

## Error Responses

All endpoints may return error responses in this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "statusCode": 400,
  "details": {
    // Additional error context
  }
}
```

Common error codes:
- `INVALID_URL`: Malformed or inaccessible URL
- `SCAN_TIMEOUT`: Scan exceeded time limit
- `UNAUTHORIZED`: Invalid or missing authentication
- `RATE_LIMITED`: Too many requests
- `SITE_NOT_FOUND`: Site ID not found in database
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions

## Rate Limits

- Anonymous scans: 10 per hour per IP
- Authenticated free tier: 50 scans per day
- Authenticated pro tier: 500 scans per day

## Webhook Events (Pro Tier)

Pro users can configure webhooks to receive scan results:

```json
{
  "event": "diagnostics.scan.completed",
  "timestamp": "2025-01-19T10:30:00Z",
  "data": {
    "auditId": "audit_123xyz",
    "siteId": "site_123456",
    "pageUrl": "https://example.com",
    "result": {
      // Full LighthouseAIReport object
    }
  }
}
```

## Version History

- **v1.0.0** (2025-01): Initial release with LighthouseAI specification
- **v1.1.0** (2025-01): Added MCP scanner and enhanced evidence details
- **v1.2.0** (2025-01): Added anonymous scanning and tiered access control

## Notes

1. All scores are normalized to 0.0-1.0 range internally, with percentage (0-100) provided for display
2. Scanner execution is parallelized with a 30-second timeout per scanner
3. Results are cached for 24 hours to reduce redundant scans
4. The system supports incremental updates where only changed indicators are rescanned
5. All timestamps are in ISO 8601 format in UTC timezone