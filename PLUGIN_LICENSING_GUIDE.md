# Lumen API Product Pricing & Licensing System Guide

This guide explains the comprehensive pricing structure and licensing system for the Lumen API, including multiple products with their own pricing tiers, query tracking, and billing management for unified products (both SaaS features and downloadable content).

## Overview

The Lumen API pricing system consists of:

1. **Three Core Products** - Each with distinct pricing tiers and features
2. **Query Tracking** - Real-time usage monitoring and validation
3. **License Management** - Product-based licensing with flexible billing
4. **Add-on Services** - Additional sites, query overages, and custom features
5. **Agent/API Access** - Programmatic access controls for different tiers
6. **Unified Product Model** - Products can include both SaaS functionality and downloadable files

## Product Portfolio

### 1. AI Readiness Analysis ($19/month base)
**Category**: Analysis | **Beta**: Yes

Comprehensive AI readiness assessment for your content with optimization insights and AI-compatibility scoring.

| Tier | Monthly | Annual | Analyses/Month | Sites | Agent/API Access |
|------|---------|--------|----------------|-------|------------------|
| **Starter** | $19 | $205 | 10 | 1 | ❌ Human UI only |
| **Starter+** | $24 | $259 | 10 | 1 | ✅ UI + Agent/API |
| **Professional** | $39 | $421 | 50 | 3 | ❌ Human UI only |
| **Professional+** | $49 | $529 | 50 | 3 | ✅ UI + Agent/API |
| **Enterprise** | $99 | $1,069 | Unlimited | 10 | ✅ UI + Agent/API |

**Features**:
- Content structure analysis
- SEO optimization insights  
- AI-readiness scoring
- Improvement recommendations
- Competitive analysis
- Progress tracking

### 2. Neural Search - Knowledge ($29/month base)
**Category**: Search | **Beta**: No

AI-powered semantic search for knowledge bases, documentation, and blog content.

| Tier | Monthly | Annual | Queries/Month | Sites | Agent/API Access |
|------|---------|--------|---------------|-------|------------------|
| **Basic** | $29 | $313 | 1,000 | 1 | ❌ Human UI only |
| **Basic+** | $39 | $421 | 1,000 | 1 | ✅ UI + Agent/API |
| **Standard** | $59 | $637 | 5,000 | 3 | ❌ Human UI only |
| **Standard+** | $79 | $853 | 5,000 | 3 | ✅ UI + Agent/API |
| **Enterprise** | $149 | $1,609 | Unlimited | 10 | ✅ UI + Agent/API |

**Features**:
- Semantic search across all content
- Multi-language support
- Real-time indexing
- Relevance scoring
- Search analytics
- API access

### 3. Neural Search - Product ($49/month base)
**Category**: Search | **Beta**: No

Advanced e-commerce search with natural language processing for product discovery.

| Tier | Monthly | Annual | Queries/Month | Products | Sites | Agent/API Access |
|------|---------|--------|---------------|----------|-------|------------------|
| **Essential** | $49 | $529 | 5,000 | 1,000 | 1 | ❌ Human UI only |
| **Essential+** | $69 | $745 | 5,000 | 1,000 | 1 | ✅ UI + Agent/API |
| **Growth** | $99 | $1,069 | 25,000 | 10,000 | 3 | ❌ Human UI only |
| **Growth+** | $129 | $1,393 | 25,000 | 10,000 | 3 | ✅ UI + Agent/API |
| **Enterprise** | $249 | $2,689 | Unlimited | Unlimited | 10 | ✅ UI + Agent/API |

**Features**:
- Natural language product search
- Advanced filtering and faceting
- Visual similarity search
- Recommendation engine
- Inventory-aware results
- Analytics dashboard

## Pricing Structure

### Add-ons (Enterprise tiers only)
- **Additional Sites**: $15/month per site
- **Query/Analysis Overage**: $0.50 per 100 queries/analyses (non-Enterprise tiers)
- **Custom Embedding Models**: 15% markup on base price (Neural Search products only)

### Cross-Product Bundles
- **Knowledge + Product Bundle**: 15% discount when both Neural Search products are purchased
- **Complete Suite Bundle**: 20% discount when all three products are purchased
- **Enterprise Suite**: Custom pricing for enterprise customers needing all products

## Database Models

### Core Models
- **License** - Product-based licenses with billing and usage tracking
- **QueryUsage** - Individual query tracking with performance metrics
- **PricingTier** - Configurable pricing structure
- **Product** - Unified products with SaaS features and optional downloadable content (replaces separate EcosystemProduct and Plugin models)
- **Download** - Tracking for downloadable product files

### License Types
- `standard` - Basic tier with human UI access
- `standard_plus` - Basic tier with agent/API access
- `premium` - Advanced tier with human UI access
- `premium_plus` - Advanced tier with agent/API access
- `enterprise` - Full-featured tier with unlimited queries
- `custom` - Flexible tier for special arrangements

### License Status
- `active` - License is valid and usable
- `expired` - License has passed expiration date
- `revoked` - License has been manually revoked
- `suspended` - License is temporarily disabled

### Billing Periods
- `monthly` - Monthly recurring billing
- `annual` - Annual billing with discounts

## API Endpoints

### Public Pricing Information

#### Get All Pricing Tiers
```bash
GET /api/pricing/tiers
```

#### Get Specific Pricing Tier
```bash
GET /api/pricing/tiers/{tier_name}
```

#### Calculate Custom Pricing
```bash
POST /api/pricing/calculate
Content-Type: application/json

{
  "tier_name": "enterprise",
  "billing_period": "annual",
  "additional_sites": 5,
  "custom_embedding": true
}
```

#### Get Product Pricing
```bash
GET /api/pricing/products/{product_slug}
```

#### Compare Pricing Tiers
```bash
GET /api/pricing/compare?tiers=standard,premium,enterprise
```

### License Management

#### Purchase License
```bash
POST /api/purchases/simulate
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "product_slug": "lumen-search-api",
  "tier_name": "premium_plus",
  "billing_period": "annual",
  "additional_sites": 2,
  "custom_embedding": true
}
```

#### Get User's Licenses
```bash
GET /api/licenses/my
Authorization: Bearer JWT_TOKEN
```

#### Get License Usage
```bash
GET /api/licenses/{license_id}/usage
Authorization: Bearer JWT_TOKEN
```

#### Validate License
```bash
POST /api/licenses/validate
Content-Type: application/json

{
  "license_key": "ABCD-EFGH-IJKL-MNOP",
  "product_slug": "lumen-search-api"
}
```

### Query Usage & Tracking

#### Search with Usage Tracking
```bash
POST /api/search
Authorization: Bearer JWT_TOKEN
X-License-Key: ABCD-EFGH-IJKL-MNOP
Content-Type: application/json

{
  "query": "machine learning",
  "site_id": "site-uuid"
}
```

Response includes usage headers:
```
X-Query-Usage-Current: 145
X-Query-Usage-Limit: 2000
X-Query-Usage-Remaining: 1855
X-Query-Period-End: 2024-02-15T00:00:00Z
```

#### Agent/API Access
```bash
POST /api/search/agent
Authorization: Bearer JWT_TOKEN
X-License-Key: ABCD-EFGH-IJKL-MNOP
X-Agent-ID: my-automation-bot
Content-Type: application/json

{
  "query": "automated search query",
  "site_id": "site-uuid"
}
```

#### Get Usage Statistics
```bash
GET /api/usage/stats
Authorization: Bearer JWT_TOKEN
```

### Admin Operations

#### Create Custom License
```bash
POST /api/admin/licenses
Authorization: x-api-key: YOUR_API_KEY
Content-Type: application/json

{
  "user_id": "user-uuid",
  "product_id": "product-uuid",
  "tier_name": "enterprise",
  "billing_period": "annual",
  "amount_paid": 2149.00,
  "additional_sites": 5,
  "custom_embedding": true,
  "notes": "Custom enterprise deal"
}
```

#### Gift License
```bash
POST /api/purchases/gift
Authorization: x-api-key: YOUR_API_KEY
Content-Type: application/json

{
  "user_email": "user@example.com",
  "product_slug": "lumen-search-api",
  "tier_name": "premium",
  "billing_period": "annual",
  "notes": "Conference speaker bonus"
}
```

#### Revoke License
```bash
DELETE /api/admin/licenses/{license_id}/revoke
Authorization: x-api-key: YOUR_API_KEY
```

#### Reset Query Usage
```bash
POST /api/admin/licenses/{license_id}/reset-usage
Authorization: x-api-key: YOUR_API_KEY
```

## Usage Flow

### 1. User Registration & Authentication
```bash
# Register user
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}

# Login to get JWT token
POST /api/auth/login
{
  "email": "user@example.com", 
  "password": "securepassword"
}
```

### 2. Browse Pricing Options
```bash
# View all pricing tiers
GET /api/pricing/tiers

# Calculate custom pricing
POST /api/pricing/calculate
{
  "tier_name": "enterprise",
  "billing_period": "annual",
  "additional_sites": 3
}
```

### 3. Purchase License
```bash
POST /api/purchases/simulate
Authorization: Bearer JWT_TOKEN
{
  "product_slug": "lumen-search-api",
  "tier_name": "premium_plus",
  "billing_period": "annual"
}
```

### 4. Use API with License
```bash
# Make search request
POST /api/search
Authorization: Bearer JWT_TOKEN
X-License-Key: YOUR_LICENSE_KEY
{
  "query": "artificial intelligence",
  "site_id": "your-site-uuid"
}

# Check usage
GET /api/licenses/my
Authorization: Bearer JWT_TOKEN
```

## Security Features

### Query Validation Middleware
- Validates license on every API request
- Checks query limits and agent access permissions
- Tracks usage in real-time
- Blocks requests when limits exceeded

### License Security
- Secure license key generation
- User ownership verification
- Expiration date validation
- Real-time status checking

### Usage Tracking
- Complete audit trail of all queries
- Performance metrics collection
- Billable vs non-billable query classification
- Site-specific usage tracking

## Configuration

### Environment Variables
```bash
# Query tracking
QUERY_TRACKING_ENABLED=true
MAX_QUERIES_PER_PERIOD=unlimited

# Billing
DEFAULT_CURRENCY=USD
BILLING_GRACE_PERIOD_DAYS=7

# Agent access
AGENT_ACCESS_ENABLED=true
MAX_AGENT_REQUESTS_PER_MINUTE=60
```

### Pricing Configuration
Pricing tiers are stored in the database and can be updated via admin endpoints:

```sql
-- Example pricing tier configuration
INSERT INTO "PricingTier" (
  tier_name, display_name, description,
  monthly_price, annual_price,
  max_queries, max_sites, agent_api_access,
  additional_site_price, query_overage_price,
  custom_embedding_markup
) VALUES (
  'premium_plus', 'Premium+', 'Advanced features with API access',
  59.00, 637.00,
  2000, 1, true,
  15.00, 0.50,
  0.15
);
```

## Monitoring & Analytics

### Usage Tracking
All queries are tracked with:
- User and license information
- Query type (search, embed, analysis)
- Performance metrics (response time, results count)
- Agent vs human classification
- Billable status

### License Analytics
```bash
# Get license usage statistics
GET /api/admin/analytics/licenses
Authorization: x-api-key: YOUR_API_KEY

# Get query usage trends
GET /api/admin/analytics/usage?period=30d
Authorization: x-api-key: YOUR_API_KEY

# Get revenue analytics
GET /api/admin/analytics/revenue?period=monthly
Authorization: x-api-key: YOUR_API_KEY
```

### Real-time Monitoring
- Query rate limiting
- Usage alert thresholds
- Performance monitoring
- Error rate tracking

## Testing the System

### 1. Create Test User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### 2. View Pricing Options
```bash
curl -X GET http://localhost:3000/api/pricing/tiers
```

### 3. Purchase License
```bash
curl -X POST http://localhost:3000/api/purchases/simulate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_slug": "lumen-search-api",
    "tier_name": "premium",
    "billing_period": "monthly"
  }'
```

### 4. Test API Usage
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-License-Key: YOUR_LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test query",
    "site_id": "your-site-uuid"
  }'
```

### 5. Check Usage Stats
```bash
curl -X GET http://localhost:3000/api/licenses/my \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Integration Points

### Existing System Integration
- **EcosystemProducts** - Products available for licensing
- **Sites** - Multi-site support with per-site limits
- **Users** - Existing user management and authentication
- **ActivityLogs** - Complete audit trail integration

### Frontend Integration
The pricing system provides public endpoints for building pricing pages:
- Tier comparison tables
- Pricing calculators
- Usage dashboards
- Billing management

### Third-party Integration
- Payment processor integration (Stripe, PayPal)
- Billing system webhooks
- Usage reporting APIs
- Customer support systems

## Migration from Plugin System

The new pricing system replaces the plugin-based licensing:

### Key Changes
- **Product-based** instead of plugin-based licensing
- **Query limits** instead of download limits
- **Subscription billing** instead of one-time purchases
- **Usage tracking** for real-time monitoring
- **Tiered pricing** with clear feature differentiation

### Migration Steps
1. Export existing licenses and user data
2. Map old license types to new tiers
3. Update frontend to use new pricing endpoints
4. Implement billing integration
5. Train support team on new system

## Next Steps

1. **Payment Integration** - Replace simulation with real billing
2. **Frontend Dashboard** - Build user-facing usage and billing UI
3. **Advanced Analytics** - Detailed usage and revenue reporting
4. **Auto-scaling** - Automatic tier upgrades based on usage
5. **Partner Program** - Reseller and affiliate management
6. **Enterprise Features** - Custom contracts and bulk licensing

## Support

For issues with the pricing system:

1. Check license status and expiration dates
2. Verify query limits and usage tracking
3. Validate agent/API access permissions
4. Review billing period and payment status
5. Check server logs for detailed error messages

The system provides comprehensive error messages, usage headers, and real-time validation to help diagnose issues quickly. 