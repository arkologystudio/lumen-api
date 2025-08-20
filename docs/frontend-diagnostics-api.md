# Frontend Diagnostics API Specification

## Overview

The Diagnostics API returns results compliant with the **Lighthouse AI Readiness Index v1.0** specification. All scores use a **0-1 range** internally, with `score_0_100` for display purposes.

## API Endpoints

### Anonymous Scan
```
POST /v1/diagnostics/scan-url
Body: { "url": "https://example.com" }
```

### Authenticated Scan  
```
POST /v1/diagnostics/scan
Body: { "siteId": "uuid", "options": {...} }
```

### Get Latest Results
```
GET /v1/diagnostics/sites/:siteId/score
```

## Response Structure

```typescript
interface LighthouseAIReport {
  site: {
    url: string;
    scan_date: string; // YYYY-MM-DD format
    category: SiteProfile;
  };
  categories: {
    discovery: Category;
    understanding: Category; 
    actions: Category;
    trust: Category;
  };
  weights: {
    discovery: 0.30;    // Fixed weight
    understanding: 0.30; // Fixed weight  
    actions: 0.25;      // Fixed weight
    trust: 0.15;        // Fixed weight
  };
  overall: {
    raw_0_1: number;    // 0.0 to 1.0 range
    score_0_100: number; // 0 to 100 for display
  };
}

interface Category {
  score: number; // 0.0 to 1.0 range
  indicators: SpecIndicator[];
}

interface SpecIndicator {
  name: string;
  score: number; // 0.0 to 1.0 range
  status: 'pass' | 'warn' | 'fail' | 'not_applicable';
  message: string;
  applicability: {
    status: 'required' | 'optional' | 'not_applicable';
    included_in_category_math: boolean;
  };
  evidence?: object; // Detailed scanner results
}
```

## Site Profiles

| Profile | Description |
|---------|-------------|
| `blog_content` | Content-focused sites, blogs |
| `ecommerce` | Online stores, product catalogs |  
| `saas_app` | Software-as-a-Service applications |
| `kb_support` | Knowledge bases, help centers |
| `gov_nontransacting` | Government information sites |
| `custom` | Default/unclassified sites |

## Indicators by Category

### Discovery (Weight: 0.30)
- `seo_basic` - Title, meta description, headings
- `sitemap_xml` - XML sitemap presence
- `canonical_url` - Canonical URL implementation

### Understanding (Weight: 0.30)  
- `json_ld` - Structured data markup
- `llms_txt` - AI agent instructions
- `agents_json` - AI agent configuration

### Actions (Weight: 0.25)
- `mcp` - Model Context Protocol support
- *(Additional action-oriented indicators)*

### Trust (Weight: 0.15)
- `robots_txt` - Robots.txt file and policies

## Applicability Rules

Not all indicators apply to every site type:

- **MCP**: Required for `ecommerce`/`saas_app`, not applicable for `blog_content`/`gov_nontransacting`
- **llms.txt**: Required for `blog_content`/`kb_support`/`gov_nontransacting`
- **agents.json**: Required for `ecommerce`/`saas_app`

When `applicability.included_in_category_math = false`, the indicator doesn't affect category scores.

## Score Interpretation

### Overall Score (0-100)
- **90-100**: Excellent AI readiness
- **70-89**: Good AI readiness  
- **50-69**: Needs improvement
- **0-49**: Poor AI readiness

### Category Scores (0.0-1.0)
- **0.8-1.0**: Strong performance
- **0.5-0.79**: Moderate performance
- **0.3-0.49**: Weak performance
- **0.0-0.29**: Poor performance

## Frontend Implementation Notes

1. **Display scores as percentages**: Use `score_0_100` or convert `raw_0_1 * 100`
2. **Handle applicability**: Gray out or hide indicators with `not_applicable` status
3. **Category breakdown**: Show weighted contribution to overall score
4. **Profile-specific messaging**: Tailor recommendations based on detected site profile
5. **Evidence details**: Use `indicator.evidence` for detailed explanations and next steps

## Example Response

```json
{
  "site": {
    "url": "https://shop.example.com",
    "scan_date": "2024-08-19", 
    "category": "ecommerce"
  },
  "categories": {
    "discovery": {
      "score": 0.85,
      "indicators": [...]
    },
    "understanding": {
      "score": 0.60, 
      "indicators": [...]
    },
    "actions": {
      "score": 0.40,
      "indicators": [...]
    },
    "trust": {
      "score": 0.90,
      "indicators": [...]
    }
  },
  "weights": {
    "discovery": 0.30,
    "understanding": 0.30,
    "actions": 0.25,
    "trust": 0.15
  },
  "overall": {
    "raw_0_1": 0.69,
    "score_0_100": 69
  }
}
```

This would display as **69% AI Ready** with category breakdown showing strengths in Discovery (85%) and Trust (90%), but opportunities in Understanding (60%) and Actions (40%).