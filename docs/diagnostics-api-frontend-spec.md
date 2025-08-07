# Diagnostics API - Frontend Integration Specification

## Overview

The Diagnostics API provides comprehensive website AI-readiness analysis. All endpoints require authentication via JWT token in the Authorization header.

## Authentication

```
Authorization: Bearer <jwt_token>
```

## Base URL

```
https://api.lighthouse.ai/v1/diagnostics
```

## API Endpoints

### 1. Trigger Diagnostic Scan

**POST** `/scan`

Initiates a diagnostic scan for a website.

**Request Body:**
```json
{
  "siteId": "uuid-string",
  "options": {
    "auditType": "full",        // Options: "full", "quick", "scheduled", "on_demand"
    "includeSitemap": true,     // Pro only - scan sitemap pages
    "maxPages": 10,             // Free: max 5, Pro: max 20
    "storeRawData": false,      // Pro only - store HTML/screenshots
    "skipCache": false          // Force fresh scan
  }
}
```

**Response (200 OK):**
```json
{
  "message": "Diagnostic scan completed",
  "auditId": "audit-uuid",
  "status": "completed",        // or "failed"
  "duration": 45.3,             // seconds
  "result": {
    "siteScore": {
      "overall": 85,
      "breakdown": {
        "standards": 90,
        "structured_data": 80,
        "seo": 85,
        "accessibility": 82
      }
    },
    "aiReadiness": "good",      // "excellent" | "good" | "needs_improvement" | "poor"
    "accessIntent": "allow",    // "allow" | "partial" | "block"
    "summary": {
      "totalIndicators": 24,
      "passedIndicators": 20,
      "warnedIndicators": 3,
      "failedIndicators": 1,
      "topIssues": [
        "Missing llms.txt file",
        "No structured data found on 3 pages"
      ],
      "topRecommendations": [
        "Create an llms.txt file at the root of your website",
        "Add JSON-LD structured data to improve AI understanding"
      ]
    }
  }
}
```

**Error Responses:**
- `400` - Invalid request (missing siteId)
- `401` - Authentication required
- `404` - Site not found or access denied
- `500` - Scan failed (check error details)

### 2. Get Site Score

**GET** `/sites/:siteId/score`

Retrieves the latest diagnostic score for a site.

**Response (200 OK) - Free Tier:**
```json
{
  "siteScore": {
    "overall": 85
  },
  "aiReadiness": "good",
  "accessIntent": "allow",
  "summary": {
    "totalIndicators": 24,
    "passedIndicators": 20,
    "failedIndicators": 1
  },
  "auditId": "audit-uuid"
}
```

**Response (200 OK) - Pro Tier:**
```json
{
  "siteScore": {
    "overall": 85,
    "breakdown": {
      "standards": 90,
      "structured_data": 80,
      "seo": 85,
      "accessibility": 82
    }
  },
  "aiReadiness": "good",
  "accessIntent": "allow",
  "summary": {
    "totalIndicators": 24,
    "passedIndicators": 20,
    "warnedIndicators": 3,
    "failedIndicators": 1,
    "topIssues": [...],
    "topRecommendations": [...]
  },
  "categoryScores": [
    {
      "category": "standards",
      "score": 90,
      "weight": 2.0,
      "indicatorCount": 8
    },
    // ... more categories
  ],
  "auditId": "audit-uuid"
}
```

**Error Responses:**
- `404` - No diagnostic results found (run a scan first)

### 3. Get Page Indicators (Pro Only)

**GET** `/pages/:pageId/indicators`

Retrieves detailed indicator results for a specific page.

**Query Parameters:**
- `category` - Filter by category (optional)
- `status` - Filter by status: "pass", "warn", "fail" (optional)
- `limit` - Results per page (default: 50, max: 100)
- `offset` - Pagination offset (default: 0)

**Response (200 OK):**
```json
{
  "indicators": [
    {
      "id": "indicator-uuid",
      "indicatorName": "llms_txt",
      "category": "standards",
      "status": "fail",
      "score": 0,
      "weight": 2.0,
      "message": "No llms.txt file found",
      "recommendation": "Create an llms.txt file at the root of your website",
      "details": {
        "checkedUrl": "https://example.com/llms.txt",
        "statusCode": 404,
        "error": "Not found"
      },
      "checkedUrl": "https://example.com/llms.txt",
      "found": false,
      "isValid": false,
      "scannedAt": "2024-01-15T10:30:00Z"
    }
    // ... more indicators
  ],
  "pagination": {
    "total": 24,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Error Responses:**
- `403` - Pro subscription required

### 4. Trigger Rescore (Pro Only)

**POST** `/trigger-rescore`

Forces an immediate rescan bypassing cache.

**Request Body:**
```json
{
  "siteId": "uuid-string"
}
```

**Response (200 OK):**
```json
{
  "message": "Rescore completed",
  "auditId": "audit-uuid",
  "status": "completed",
  "duration": 52.1
}
```

### 5. Get Audit Details

**GET** `/audits/:auditId`

Retrieves comprehensive details for a specific audit.

**Response (200 OK):**
```json
{
  "id": "audit-uuid",
  "siteId": "site-uuid",
  "siteName": "Example Site",
  "siteUrl": "https://example.com",
  "auditType": "full",
  "status": "completed",
  "siteScore": 85,
  "aiReadiness": "good",
  "accessIntent": "allow",
  "startedAt": "2024-01-15T10:00:00Z",
  "completedAt": "2024-01-15T10:00:45Z",
  "errorMessage": null,
  "pages": [
    {
      "id": "page-uuid",
      "url": "https://example.com",
      "title": "Home Page",
      "pageScore": 88,
      "indicatorCount": 12
    }
    // ... more pages
  ],
  "categoryScores": [
    {
      "category": "standards",
      "score": 90,
      "weight": 2.0
    }
    // ... more categories
  ]
}
```

## Data Models

### Indicator Categories
- `standards` - AI-readiness files (llms.txt, agent.json, etc.)
- `structured_data` - JSON-LD and schema.org markup
- `seo` - SEO indicators (title, meta, canonical)
- `accessibility` - Robots directives and access control

### Indicator Status
- `pass` - Indicator meets requirements (score: 8-10)
- `warn` - Indicator has issues (score: 3-7)
- `fail` - Indicator failed or missing (score: 0-2)
- `not_applicable` - Not relevant for this page

### AI Readiness Levels
- `excellent` - Score 90-100
- `good` - Score 70-89
- `needs_improvement` - Score 40-69
- `poor` - Score 0-39

### Access Intent
- `allow` - Site allows AI access
- `partial` - Some restrictions in place
- `block` - Site blocks AI access

## Subscription Tiers

### Free Tier Limitations
- Basic site score only (no breakdown)
- Limited to 5 pages per scan
- No page-level details
- No raw data storage
- 24-hour result caching

### Pro Tier Features
- Full score breakdowns
- Up to 20 pages per scan
- Page-level indicator details
- Raw HTML/screenshot storage
- On-demand rescoring
- Scheduled audits (coming soon)
- Webhook notifications (coming soon)

## Frontend Implementation Tips

### 1. Scan Flow
```javascript
// Trigger scan
const scanResult = await fetch('/diagnostics/scan', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ siteId, options })
});

// If scan is async (future), poll for status
// Currently scans are synchronous and return immediately
```

### 2. Display Recommendations
- Show overall gauge with color coding based on `aiReadiness`
- Display indicator cards grouped by category
- Use status chips with colors: 
  - Pass: Green
  - Warn: Yellow/Orange
  - Fail: Red
- Show "Why it matters" tooltips for each indicator
- Display recommendations in expandable accordions

### 3. Access Intent Banner
- Show neutral language about AI access posture
- Use lock icon (🔒) for visual indicator
- Provide tooltip explaining implications

### 4. Pro Upsell Points
- Page-level details behind "Pro" badge
- "View all indicators" CTAs for free users
- "Schedule regular audits" as Pro feature
- "Export detailed report" for Pro users

### 5. Error Handling
```javascript
try {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.json();
    
    if (response.status === 403) {
      // Show Pro upsell modal
    } else if (response.status === 404) {
      // Prompt to run first scan
    } else {
      // Show error message
    }
  }
} catch (error) {
  // Network or parsing error
}
```

## Rate Limits

- Free tier: 10 scans per day
- Pro tier: 100 scans per day
- Per-endpoint rate limits apply

## Support

For API issues or questions:
- Documentation: https://docs.lighthouse.ai/diagnostics
- Support: support@lighthouse.ai