# Lumen Neural Search API Structure

## Overview

This API provides a comprehensive neural search solution for websites with proper user and site management. Users can register, manage multiple sites, and perform neural search operations on their content. The system includes an ecosystem of products that users can register for their sites, including knowledge search, product search, and AI analysis tools.

## Architecture Principles

- **User-centric**: Each user can own multiple sites
- **Secure**: Proper authentication and authorization
- **Scalable**: Multi-tenant architecture with isolated vector collections
- **Functional**: Following functional programming principles
- **Type-safe**: Strong TypeScript typing throughout
- **Unified Product Model**: Products can include both SaaS features and downloadable content

## API Endpoints

### 🔐 Authentication (`/api/auth`)

#### POST `/api/auth/register`
Register a new user.
```typescript
// Request
{
  email: string;
  password: string;
  name: string;
}

// Response
{
  success: boolean;
  data: {
    user: User;
    token: string;
    expires_in: number;
  };
  message: string;
}
```

#### POST `/api/auth/login`
Login existing user.
```typescript
// Request
{
  email: string;
  password: string;
}

// Response - same as register
```

#### POST `/api/auth/token` (Legacy)
Generate short-lived JWT for legacy clients.

### 👤 User Management (`/api/users`)
*All endpoints require user authentication*

#### GET `/api/users/profile`
Get current user's profile.

#### PUT `/api/users/profile`
Update user profile.
```typescript
// Request
{
  name?: string;
  email?: string;
}
```

#### GET `/api/users/sites`
Get all sites owned by the current user.

### 🌐 Site Management (`/api/sites`)
*All endpoints require user authentication*

#### POST `/api/sites`
Create a new site.
```typescript
// Request
{
  name: string;
  url: string;
  description?: string;
}

// Response
{
  success: boolean;
  data: Site;
  message: string;
}
```

#### GET `/api/sites/:site_id`
Get site details (user must own the site).

#### PUT `/api/sites/:site_id`
Update site details.
```typescript
// Request
{
  name?: string;
  url?: string;
  description?: string;
  is_active?: boolean;
}
```

#### DELETE `/api/sites/:site_id`
Delete site and all associated data.

#### GET `/api/sites/:site_id/stats`
Get detailed site statistics including vector store data.

#### POST `/api/sites/:site_id/search`
Search within a specific site.
```typescript
// Request
{
  query: string;
  topK?: number; // Default: 10
}

// Response
{
  success: boolean;
  data: {
    results: SearchResult[];
    site_id: string;
    query: string;
    totalPosts: number;
    totalChunks: number;
  };
}
```

#### POST `/api/sites/:site_id/embed`
Embed content for a site.
```typescript
// Request
{
  posts: EmbedRequest[];
  site_name?: string;
  site_url?: string;
}

// Response - immediate response with background processing
{
  success: boolean;
  message: string;
  data: {
    status: "processing";
    processingStarted: string;
    siteId: string;
    // ... additional stats
  };
}
```

### 🏢 Products (`/api/products`)
*Public endpoints for browsing products*

#### GET `/api/products`
Get all available products.
```typescript
// Query parameters
?category=search  // Optional: filter by category

// Response
{
  success: boolean;
  products: Product[];
  total: number;
}
```

#### GET `/api/products/:slug`
Get specific product details.
```typescript
// Response
{
  success: boolean;
  product: Product;
}
```

#### GET `/api/categories`
Get available product categories.
```typescript
// Response
{
  success: boolean;
  categories: string[];
  total: number;
}
```

### 🏢 Ecosystem Products (`/api/ecosystem`)
*All endpoints require user authentication*

#### GET `/api/ecosystem/products`
Get all available ecosystem products.
```typescript
// Query parameters
?category=search  // Optional: filter by category

// Response
{
  success: boolean;
  products: EcosystemProduct[];
  total: number;
}
```

#### GET `/api/ecosystem/products/:slug`
Get specific ecosystem product details.
```typescript
// Response
{
  success: boolean;
  product: EcosystemProduct;
}
```

#### GET `/api/ecosystem/categories`
Get available product categories.
```typescript
// Response
{
  success: boolean;
  categories: string[];
  total: number;
}
```

#### GET `/api/sites/:siteId/products`
Get products registered for a site.
```typescript
// Query parameters
?enabled_only=true  // Optional: filter to enabled products only

// Response
{
  success: boolean;
  products: SiteProduct[];
  total: number;
}
```

#### POST `/api/sites/:siteId/products`
Register a product for a site.
```typescript
// Request
{
  product_slug: string;
  config?: Record<string, any>;
}

// Response
{
  success: boolean;
  site_product: SiteProduct;
  message: string;
}
```

#### PUT `/api/sites/:siteId/products/:productSlug`
Update site product configuration.
```typescript
// Request
{
  is_enabled?: boolean;
  config?: Record<string, any>;
  usage_limits?: Record<string, any>;
}

// Response
{
  success: boolean;
  site_product: SiteProduct;
  message: string;
}
```

#### DELETE `/api/sites/:siteId/products/:productSlug`
Unregister a product from a site.

#### GET `/api/sites/:siteId/products/:productSlug/status`
Check if a product is active for a site.
```typescript
// Response
{
  success: boolean;
  has_product: boolean;
  enabled: boolean;
}
```

### 🎫 Plugin Licensing (`/api/licenses`)
*User endpoints require user authentication, admin endpoints require API key authentication*

#### GET `/api/licenses/user`
Get all licenses for the current user.
```typescript
// Query parameters
?status=active  // Optional: filter by license status
?product_slug=plugin-name  // Optional: filter by product

// Response
{
  success: boolean;
  licenses: License[];
  total: number;
}
```

#### GET `/api/licenses/user/:license_id`
Get specific license details for the current user.
```typescript
// Response
{
  success: boolean;
  license: License;
}
```

#### GET `/api/licenses/user/stats`
Get license statistics for the current user.
```typescript
// Response
{
  success: boolean;
  stats: {
    total_licenses: number;
    active_licenses: number;
    expired_licenses: number;
    downloads_used: number;
    downloads_remaining: number;
  };
}
```

#### POST `/api/licenses/validate` 
Validate a license key.
```typescript
// Request
{
  license_key: string;
  product_slug?: string;
}

// Response
{
  success: boolean;
  valid: boolean;
  license?: License;
  reason?: string;
}
```

#### POST `/api/licenses/admin` (Admin)
Create a new license.
```typescript
// Request
{
  user_id: string;
  product_slug: string;
  license_type: 'trial' | 'standard' | 'premium' | 'lifetime';
  max_downloads?: number;
  expires_at?: string;
  notes?: string;
}

// Response
{
  success: boolean;
  license: License;
  message: string;
}
```

#### PUT `/api/licenses/admin/:license_id` (Admin)
Update a license.
```typescript
// Request
{
  status?: 'active' | 'expired' | 'revoked' | 'suspended';
  max_downloads?: number;
  expires_at?: string;
  notes?: string;
}
```

#### DELETE `/api/licenses/admin/:license_id` (Admin)
Revoke a license.

### 🔄 Plugin Downloads (`/api/downloads`)
*All endpoints require user authentication*

#### POST `/api/downloads/initiate`
Initiate a plugin download (creates temporary download token).
```typescript
// Request
{
  product_slug: string;
  license_key: string;
}

// Response
{
  success: boolean;
  download_token: string;
  expires_at: string;
  plugin: {
    name: string;
    filename: string;
    file_size: number;
    version: string;
  };
}
```

#### GET `/api/downloads/file/:download_token`
Download the plugin file using the temporary token.
```typescript
// Response: File stream with proper headers
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="plugin-name.zip"
Content-Length: file_size
```

#### GET `/api/downloads/user/history`
Get download history for the current user.
```typescript
// Query parameters
?limit=20  // Optional: number of downloads to return
?offset=0  // Optional: pagination offset

// Response
{
  success: boolean;
  downloads: Download[];
  total: number;
  has_more: boolean;
}
```

### 💰 Pricing Information (`/api/pricing`)
*Public endpoints - no authentication required*

#### GET `/api/pricing/tiers`
Get all available pricing tiers.
```typescript
// Response
{
  success: boolean;
  tiers: Array<{
    id: string;
    tier_name: string;
    display_name: string;
    description: string;
    monthly_price: number;
    annual_price: number;
    max_queries?: number;
    max_sites: number;
    agent_api_access: boolean;
    extra_site_price?: number;
    overage_price?: number;
    custom_embedding_markup: number;
    features: string[];
    is_active: boolean;
    sort_order: number;
  }>;
  add_ons: {
    extra_site_price: number;
    query_overage_price: number;
    custom_embedding_markup: number;
  };
  total: number;
}
```

#### GET `/api/pricing/tiers/:tier_name`
Get specific pricing tier details.
```typescript
// Response
{
  success: boolean;
  tier: {
    id: string;
    tier_name: string;
    display_name: string;
    description: string;
    monthly_price: number;
    annual_price: number;
    max_queries?: number;
    max_sites: number;
    agent_api_access: boolean;
    extra_site_price?: number;
    overage_price?: number;
    custom_embedding_markup: number;
    features: string[];
    is_active: boolean;
    sort_order: number;
  };
}
```

#### POST `/api/pricing/calculate`
Calculate pricing for a configuration.
```typescript
// Request
{
  license_type: 'standard' | 'standard_plus' | 'premium' | 'premium_plus' | 'enterprise';
  billing_period?: 'monthly' | 'annual';
  additional_sites?: number;
  custom_embedding?: boolean;
  query_overage?: number;
}

// Response
{
  success: boolean;
  pricing: {
    license_type: string;
    billing_period: string;
    base_price: number;
    add_ons: {
      additional_sites: {
        count: number;
        unit_price: number;
        total_cost: number;
      };
      custom_embedding: {
        enabled: boolean;
        markup_percentage: number;
        total_cost: number;
      };
      query_overage: {
        count: number;
        unit_price: number;
        total_cost: number;
      };
    };
    total_price: number;
    annual_savings: number;
    annual_savings_percentage: number;
    currency: string;
  };
  tier_details: {
    tier_name: string;
    display_name: string;
    max_queries?: number;
    max_sites: number;
    agent_api_access: boolean;
    features: string[];
  };
}
```

#### GET `/api/pricing/products/:product_slug/tiers`
Get pricing tiers for a specific product.
```typescript
// Response
{
  success: boolean;
  product: {
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
  };
  pricing_tiers: PricingTier[];
  add_ons: {
    extra_site_price: number;
    query_overage_price: number;
    custom_embedding_markup: number;
  };
  total: number;
}
```

#### GET `/api/pricing/comparison`
Get pricing tier comparison data.
```typescript
// Response
{
  success: boolean;
  comparison: {
    tiers: Array<{
      tier_name: string;
      display_name: string;
      monthly_price: number;
      annual_price: number;
      max_queries?: number;
      max_sites: number;
      agent_api_access: boolean;
      features: string[];
      sort_order: number;
      recommended: boolean;
    }>;
    features: Array<{
      name: string;
      standard: string | boolean;
      standard_plus: string | boolean;
      premium: string | boolean;
      premium_plus: string | boolean;
      enterprise: string | boolean;
    }>;
    add_ons: {
      extra_site_price: number;
      query_overage_price: number;
      custom_embedding_markup: number;
    };
  };
}
```

### 🛒 Plugin Purchases (`/api/purchases`)
*All endpoints require user authentication*

#### GET `/api/purchases/available`
Browse available plugins for purchase.
```typescript
// Response
{
  success: boolean;
  products: Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    category: string;
    base_price: number;
    features: string[];
    has_license: boolean;
    license_status?: string;
  }>;
  total: number;
}
```

#### POST `/api/purchases/simulate`
Simulate a plugin purchase (creates license without billing).
```typescript
// Request
{
  product_slug: string;
  license_type: 'trial' | 'standard' | 'premium' | 'lifetime';
}

// Response
{
  success: boolean;
  purchase: {
    purchase_reference: string;
    product: EcosystemProduct;
    license: License;
  };
  message: string;
}
```

#### GET `/api/purchases/user/history`
Get purchase history for the current user.
```typescript
// Response
{
  success: boolean;
  purchases: Array<{
    purchase_reference: string;
    product_name: string;
    license_type: string;
    purchased_at: string;
    license: License;
  }>;
  total: number;
}
```

#### POST `/api/purchases/admin/gift` (Admin)
Gift a license to a user.
```typescript
// Request
{
  user_id: string;
  product_slug: string;
  license_type: 'trial' | 'standard' | 'premium' | 'lifetime';
  notes?: string;
}
```

### 🔧 Admin Functions (`/api/admin`)
*All endpoints require API key authentication*

#### GET `/api/admin/users`
Get all users in the system.

#### GET `/api/admin/sites`
Get all sites with optional filtering.
```typescript
// Query parameters
?query=search_term&user_id=user_uuid
```

#### GET `/api/admin/collections`
Get all vector collections.

#### GET `/api/admin/stats`
Get comprehensive system statistics.

#### GET `/api/admin/sites/:site_id/chunks/count`
Get chunk count for a specific site.

#### GET `/api/admin/sites/:site_id/embedding/status`
Get embedding status for a specific site.

#### DELETE `/api/admin/sites/:site_id/collection`
Drop vector collection for a site.

#### GET `/api/admin/ecosystem/products`
Get all ecosystem products (including inactive).
```typescript
// Query parameters
?include_inactive=true  // Optional: include inactive products

// Response
{
  success: boolean;
  products: EcosystemProductWithStats[];
  total: number;
}
```

#### POST `/api/admin/ecosystem/products`
Create a new ecosystem product.
```typescript
// Request
{
  name: string;
  slug: string;
  description: string;
  category: string;
  version?: string;
  is_active?: boolean;
  is_beta?: boolean;
  base_price?: number;
  usage_based?: boolean;
  features?: string[];
  limits?: Record<string, any>;
}

// Response
{
  success: boolean;
  product: EcosystemProduct;
  message: string;
}
```

#### PUT `/api/admin/ecosystem/products/:slug`
Update an ecosystem product.
```typescript
// Request - any EcosystemProduct fields
{
  name?: string;
  description?: string;
  is_active?: boolean;
  base_price?: number;
  // ... other fields
}

// Response
{
  success: boolean;
  product: EcosystemProduct;
  message: string;
}
```

#### DELETE `/api/admin/ecosystem/products/:slug`
Delete an ecosystem product (only if not in use).
```typescript
// Response
{
  success: boolean;
  message: string;
  sites_using_product?: number; // If deletion fails
}
```

### 📡 Legacy Endpoints (`/api/embedding`)
*Maintained for backward compatibility*

- All original endpoints are preserved
- Use new structured endpoints for new integrations

## Data Models

### User
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  subscription_tier?: 'free' | 'pro' | 'enterprise';
}
```

### Site
```typescript
interface Site {
  id: string;
  user_id: string;
  name: string;
  url: string;
  description?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  embedding_status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  last_embedding_at?: string;
  post_count: number;
  chunk_count: number;
}
```

### Product (Unified from EcosystemProduct and Plugin)
```typescript
interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  version: string;
  is_active: boolean;
  is_beta: boolean;
  base_price?: number;
  usage_based: boolean;
  features?: string[];
  limits?: Record<string, any>;
  extended_documentation?: string;
  
  // File information (for downloadable products)
  filename?: string;
  file_path?: string;
  file_size?: number;
  file_hash?: string;
  content_type?: string;
  is_public?: boolean;
  
  // Release information
  release_notes?: string;
  changelog?: string;
  max_downloads?: number;
  
  created_at: string;
  updated_at: string;
}
```

### SiteProduct
```typescript
interface SiteProduct {
  id: string;
  site_id: string;
  product_id: string;
  is_enabled: boolean;
  enabled_at: string;
  disabled_at?: string;
  config?: Record<string, any>;
  usage_limits?: Record<string, any>;
  last_used_at?: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
  product?: Product;
}
```

### License
```typescript
interface License {
  id: string;
  user_id: string;
  product_id: string;
  license_key: string;
  license_type: 'trial' | 'standard' | 'premium' | 'lifetime';
  status: 'active' | 'expired' | 'revoked' | 'suspended';
  issued_at: string;
  expires_at?: string;
  download_count: number;
  max_downloads?: number;
  purchase_reference?: string;
  notes?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  user?: User;
  product?: Product;
}
```

### Download
```typescript
interface Download {
  id: string;
  user_id: string;
  license_id: string;
  product_id: string;
  download_token: string;
  token_expires: string;
  ip_address?: string;
  user_agent?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired';
  bytes_downloaded?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
  user?: User;
  license?: License;
  product?: Product;
}
```

## Authentication

### User Authentication (Bearer Token)
```
Authorization: Bearer <jwt_token>
```
Used for all user and site management endpoints.

### API Key Authentication
```
x-api-key: <api_key>
```
Used for admin endpoints and legacy server-to-server communication.

## Error Handling

All endpoints return consistent error responses:
```typescript
{
  success: false;
  error: string;
  code?: string; // For specific error types
  details?: any; // Additional error context
}
```

## Rate Limiting

- Search endpoints: Rate limited per token/IP
- Other endpoints: Standard rate limiting applied

## Best Practices

1. **Always use the new structured endpoints** for new integrations
2. **Implement proper error handling** for all API calls
3. **Store and refresh JWT tokens** appropriately
4. **Use site-specific endpoints** rather than legacy global endpoints
5. **Monitor embedding status** for background operations
6. **Implement client-side rate limiting** for search operations
7. **Register appropriate ecosystem products** for your site's functionality
8. **Check product status** before attempting to use features

## Migration from Legacy API

1. Replace direct embedding calls with user registration + site creation flow
2. Update search calls to use site-specific endpoints
3. Implement user authentication in your frontend
4. Use admin endpoints for system monitoring and management

## Examples

### Complete User Flow
```typescript
// 1. Register user
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securePassword123',
    name: 'John Doe'
  })
});

const { data: { token } } = await registerResponse.json();

// 2. Create site
const siteResponse = await fetch('/api/sites', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'My Blog',
    url: 'https://myblog.com',
    description: 'My personal blog'
  })
});

const { data: site } = await siteResponse.json();

// 3. Embed content
await fetch(`/api/sites/${site.id}/embed`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    posts: [/* your posts */]
  })
});

// 4. Search content
const searchResponse = await fetch(`/api/sites/${site.id}/search`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    query: 'machine learning',
    topK: 5
  })
});

const { data: results } = await searchResponse.json();
```

### Ecosystem Products Flow
```typescript
// 1. Browse available products
const productsResponse = await fetch('/api/ecosystem/products', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { products } = await productsResponse.json();

// 2. Register Neural Search - Knowledge for the site
await fetch(`/api/sites/${site.id}/products`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    product_slug: 'neural-search-knowledge',
    config: {
      search_limit: 1000,
      analytics_enabled: true
    }
  })
});

// 3. Check if product is active for site
const statusResponse = await fetch(`/api/sites/${site.id}/products/neural-search-knowledge/status`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { has_product, enabled } = await statusResponse.json();

// 4. Get all registered products for site
const siteProductsResponse = await fetch(`/api/sites/${site.id}/products`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { products: siteProducts } = await siteProductsResponse.json();
```

## Available Ecosystem Products

The system comes with three pre-configured products:

1. **Neural Search - Knowledge** ($29/month)
   - Semantic search for content, documentation, blogs
   - Multi-language support, real-time indexing
   - Categories: `search`

2. **Neural Search - Product** ($49/month)
   - E-commerce product search with filtering
   - Natural language product discovery
   - Categories: `search`

3. **AI Readiness Analysis** ($19/month, Beta)
   - Content optimization insights
   - SEO and AI-readiness scoring
   - Categories: `analysis`

---

# Activity Logging API

The Activity Logging system tracks all user actions for the Recent Activity feed in the frontend. All user interactions are automatically logged with detailed metadata.

## Activity Types

The system tracks these activity types:

- **User Activities**: `user_registered`, `user_login`, `user_profile_updated`, `user_password_changed`
- **Site Activities**: `site_created`, `site_updated`, `site_deleted`, `site_embedded`
- **Product Activities**: `product_registered`, `product_updated`, `product_unregistered`, `product_used`
- **Search Activities**: `search_performed`
- **API Activities**: `api_key_created`, `api_key_deleted`

## User Activity Endpoints

### Get User Activities
Get recent activities for the current user.

```http
GET /api/users/activities
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `limit` (number, default: 20) - Number of activities to return
- `offset` (number, default: 0) - Pagination offset
- `activity_types` (string) - Comma-separated activity types to filter
- `site_id` (string) - Filter activities for specific site

**Response:**
```json
{
  "success": true,
  "activities": [
    {
      "id": "activity_uuid",
      "user_id": "user_uuid",
      "activity_type": "product_registered",
      "title": "Product registered: Neural Search - Knowledge",
      "description": "Registered Neural Search - Knowledge for site",
      "site_id": "site_uuid",
      "target_id": "product_uuid",
      "target_type": "ecosystem_product",
      "metadata": {
        "product_name": "Neural Search - Knowledge",
        "product_slug": "neural-search-knowledge",
        "site_id": "site_uuid"
      },
      "ip_address": "192.168.1.1",
      "created_at": "2024-01-15T10:30:00Z",
      "user": {
        "id": "user_uuid",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "site": {
        "id": "site_uuid",
        "name": "My Website",
        "url": "https://example.com"
      }
    }
  ],
  "total": 25,
  "has_more": true
}
```

### Get User Activity Statistics
Get activity statistics for the current user.

```http
GET /api/users/activities/stats
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `site_id` (string) - Filter stats for specific site
- `days` (number, default: 30) - Number of days to analyze

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_activities": 25,
    "recent_activity_count": 15,
    "activities_by_type": {
      "user_login": 8,
      "product_registered": 3,
      "site_created": 2,
      "user_profile_updated": 1
    }
  }
}
```

## Site Activity Endpoints

### Get Site Activities
Get activities for a specific site.

```http
GET /api/sites/:siteId/activities
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `limit` (number, default: 20) - Number of activities to return
- `offset` (number, default: 0) - Pagination offset
- `activity_types` (string) - Comma-separated activity types to filter

**Response:** Same format as user activities, but filtered for the specific site.

### Get Site Activity Statistics

```http
GET /api/sites/:siteId/activities/stats
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `days` (number, default: 30) - Number of days to analyze

## Admin Activity Endpoints (API Key Required)

### Get System Activities
Get system-wide activities (admin only).

```http
GET /api/admin/activities
X-API-Key: <admin_api_key>
```

**Query Parameters:**
- `limit` (number, default: 50) - Number of activities to return
- `offset` (number, default: 0) - Pagination offset
- `activity_types` (string) - Comma-separated activity types to filter
- `user_id` (string) - Filter activities for specific user
- `site_id` (string) - Filter activities for specific site

### Get System Activity Statistics

```http
GET /api/admin/activities/stats
X-API-Key: <admin_api_key>
```

**Query Parameters:**
- `user_id` (string) - Filter stats for specific user
- `site_id` (string) - Filter stats for specific site
- `days` (number, default: 30) - Number of days to analyze

## Activity Data Model

### ActivityLog
```typescript
interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  title: string;
  description?: string;
  site_id?: string;
  target_id?: string;
  target_type?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  user?: User;
  site?: Site;
}
```

## Integration Notes

- Activities are automatically logged when users perform actions
- Failed activity logging doesn't block the main operation
- Activities include IP address and user agent for security tracking
- Metadata provides additional context for each activity
- All timestamps are in ISO 8601 format
- Activities are sorted by creation date (newest first)
- Pagination uses `has_more` flag to indicate additional pages
``` 