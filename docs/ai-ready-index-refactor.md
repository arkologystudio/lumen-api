# AI-Ready Index Refactor Summary

## Overview
This refactor aligns the diagnostics system with the Lighthouse AI Readiness Index (Light) v1.0 specification.

## Key Changes Implemented

### 1. Site Profile Detection System (`src/services/diagnostics/profileDetector.ts`)
- Detects site types: `blog_content`, `ecommerce`, `saas_app`, `kb_support`, `gov_nontransacting`, `custom`
- Uses heuristics based on structured data, URL patterns, and SEO metadata
- Supports client-declared profile override
- Returns confidence score and detection signals

### 2. Applicability Matrix (`src/services/diagnostics/applicabilityMatrix.ts`)
- Implements the specification's applicability matrix
- Determines which indicators are `required`, `optional`, or `not_applicable` per site type
- Controls inclusion in category score calculations
- Provides human-readable reasons for applicability decisions

### 3. MCP Scanner (`src/services/diagnostics/scanners/mcp.scanner.ts`)
- New scanner for Model Context Protocol detection
- Checks `/.well-known/mcp.json` endpoint
- Validates MCP configuration structure
- Reports available actions and capabilities

### 4. Spec-Compliant Aggregator (`src/services/diagnostics/specAggregator.ts`)
- Implements specification-compliant scoring (0-1 range)
- Uses category weights: Discovery (0.30), Understanding (0.30), Actions (0.25), Trust (0.15)
- Excludes non-applicable indicators from category calculations
- Outputs JSON matching the specification schema

### 5. Updated Scoring System
- Converted all scanners to use 0-1 scoring range:
  - 1.0 = Pass (valid, present)
  - 0.5 = Warn (partial, minor issues)
  - 0.0 = Fail (missing, invalid)
- Robots scanner set to weight=0 for access intent determination only

### 6. Enhanced Diagnostics Service
- Added `useSpecCompliant` option to enable new aggregator
- Added `declaredProfile` option for explicit site type
- Maintains backward compatibility with existing aggregator
- Stores spec results in diagnostic scores table

## Usage

### Running Spec-Compliant Scan
```typescript
const result = await diagnosticsService.runDiagnostic(
  userId,
  siteId,
  {
    useSpecCompliant: true,
    declaredProfile: 'ecommerce' // optional
  }
);

// Access spec-compliant result
if (result.specResult) {
  console.log('Overall Score:', result.specResult.overall.score_0_100);
  console.log('Site Profile:', result.specResult.site.category);
  console.log('Category Scores:', result.specResult.categories);
}
```

### Category Mapping
- **Discovery**: robots.txt, sitemap_xml, seo_basic
- **Understanding**: json_ld, llms_txt, canonical_urls  
- **Actions**: mcp, agent_json
- **Trust**: canonical_urls, robots.txt, seo_basic

## Testing
Comprehensive test suite added at `tests/unit/services/diagnostics/spec-compliance.test.ts`:
- Site profile detection tests
- Applicability matrix tests
- Spec-compliant aggregation tests
- MCP scanner tests
- Score calculation validation

## Migration Notes
1. The refactor maintains backward compatibility - existing code continues to work
2. To use spec-compliant mode, set `useSpecCompliant: true` in options
3. Database schema remains unchanged; spec results stored in existing tables
4. For full spec result storage, consider adding a JSON column to DiagnosticAudit table

## Future Enhancements
1. Add database migration for dedicated spec_result JSON column
2. Implement sampling strategy (up to 200 pages as per spec)
3. Add timeout and retry logic per specification
4. Create API endpoint for spec-compliant reports
5. Build UI components for spec-compliant result visualization