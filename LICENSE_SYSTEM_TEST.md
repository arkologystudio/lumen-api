# License System Test Guide

This guide provides comprehensive tests to validate the complete licensing system implementation.

## Prerequisites

1. **API Running**: Ensure the API is running locally or on staging
2. **Database**: Ensure PostgreSQL with pgvector is set up
3. **Environment**: All environment variables properly configured
4. **Test Data**: You'll need test user accounts and products

## Test 1: License Creation and Validation

### 1.1 Create Test User and Site
```bash
# Register a test user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'

# Save the JWT token from response
export JWT_TOKEN="<jwt_token_from_response>"

# Create a test site
curl -X POST http://localhost:3000/api/sites \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Site",
    "url": "https://test.example.com",
    "description": "Test site for licensing"
  }'

# Save the site_id from response
export SITE_ID="<site_id_from_response>"
```

### 1.2 Create API Key for Site
```bash
curl -X POST http://localhost:3000/api/api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Plugin Key",
    "site_id": "'$SITE_ID'",
    "scopes": ["search", "embed"]
  }'

# Save the API key from response
export API_KEY="<api_key_from_response>"
```

### 1.3 Create License for User
```bash
# First get user ID from profile
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer $JWT_TOKEN"

# Save user_id from response
export USER_ID="<user_id_from_response>"

# Create license (admin endpoint - use admin API key)
curl -X POST http://localhost:3000/api/licenses/admin \
  -H "x-api-key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER_ID'",
    "product_slug": "lumen-search-api",
    "license_type": "standard",
    "billing_period": "monthly"
  }'

# Save license_key from response
export LICENSE_KEY="<license_key_from_response>"
```

## Test 2: Search with License Validation

### 2.1 Test Valid Search Request
```bash
# Should succeed and return usage headers
curl -X POST http://localhost:3000/api/sites/$SITE_ID/search \
  -H "x-api-key: $API_KEY" \
  -H "X-License-Key: $LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test search",
    "topK": 5
  }' \
  -v
```

**Expected Result:**
- Status: 200 OK
- Headers should include:
  - `X-Query-Usage-Current: 1`
  - `X-Query-Usage-Limit: 100`
  - `X-Query-Usage-Remaining: 99`
  - `X-License-Type: standard`

### 2.2 Test Missing License Key
```bash
# Should fail with 400 Bad Request
curl -X POST http://localhost:3000/api/sites/$SITE_ID/search \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test search",
    "topK": 5
  }'
```

**Expected Result:**
- Status: 400 Bad Request
- Error: "License key required"

### 2.3 Test Invalid License Key
```bash
# Should fail with 403 Forbidden
curl -X POST http://localhost:3000/api/sites/$SITE_ID/search \
  -H "x-api-key: $API_KEY" \
  -H "X-License-Key: INVALID-KEY-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test search",
    "topK": 5
  }'
```

**Expected Result:**
- Status: 403 Forbidden
- Error: "Invalid or expired license"

## Test 3: Query Limit Enforcement

### 3.1 Create Limited License
```bash
# Create a trial license with very low limits
curl -X POST http://localhost:3000/api/licenses/admin \
  -H "x-api-key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER_ID'",
    "product_slug": "lumen-search-api",
    "license_type": "trial",
    "billing_period": "monthly",
    "max_queries": 2
  }'

export TRIAL_LICENSE_KEY="<trial_license_key_from_response>"
```

### 3.2 Test Query Limit
```bash
# First query - should succeed
curl -X POST http://localhost:3000/api/sites/$SITE_ID/search \
  -H "x-api-key: $API_KEY" \
  -H "X-License-Key: $TRIAL_LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "test 1", "topK": 5}' \
  -v

# Second query - should succeed
curl -X POST http://localhost:3000/api/sites/$SITE_ID/search \
  -H "x-api-key: $API_KEY" \
  -H "X-License-Key: $TRIAL_LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "test 2", "topK": 5}' \
  -v

# Third query - should fail with 429
curl -X POST http://localhost:3000/api/sites/$SITE_ID/search \
  -H "x-api-key: $API_KEY" \
  -H "X-License-Key: $TRIAL_LICENSE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "test 3", "topK": 5}' \
  -v
```

**Expected Result for Third Query:**
- Status: 429 Too Many Requests
- Error: "Query limit exceeded"

## Test 4: Agent Access Control

### 4.1 Test Agent Request with Standard License
```bash
# Should fail - standard license doesn't have agent access
curl -X POST http://localhost:3000/api/sites/$SITE_ID/search \
  -H "x-api-key: $API_KEY" \
  -H "X-License-Key: $LICENSE_KEY" \
  -H "X-Agent-ID: test-bot" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "agent test",
    "topK": 5
  }'
```

**Expected Result:**
- Status: 403 Forbidden
- Error: "Agent access not permitted"

### 4.2 Create Premium Plus License and Test
```bash
# Create premium_plus license with agent access
curl -X POST http://localhost:3000/api/licenses/admin \
  -H "x-api-key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER_ID'",
    "product_slug": "lumen-search-api",
    "license_type": "premium_plus",
    "billing_period": "monthly"
  }'

export PREMIUM_LICENSE_KEY="<premium_license_key_from_response>"

# Should succeed - premium_plus has agent access
curl -X POST http://localhost:3000/api/sites/$SITE_ID/search \
  -H "x-api-key: $API_KEY" \
  -H "X-License-Key: $PREMIUM_LICENSE_KEY" \
  -H "X-Agent-ID: test-bot" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "agent test",
    "topK": 5
  }' \
  -v
```

**Expected Result:**
- Status: 200 OK
- Header: `X-Agent-Access: true`

## Test 5: License Usage Tracking

### 5.1 Check License Usage
```bash
# Get license ID first
curl -X GET http://localhost:3000/api/licenses/my \
  -H "Authorization: Bearer $JWT_TOKEN"

export LICENSE_ID="<license_id_from_response>"

# Check usage details
curl -X GET http://localhost:3000/api/licenses/$LICENSE_ID/usage \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Result:**
- Should show current query usage
- Should show remaining queries
- Should show query period information

### 5.2 Reset License Usage (Admin)
```bash
# Reset query usage
curl -X POST http://localhost:3000/api/licenses/admin/$LICENSE_ID/reset-usage \
  -H "x-api-key: $ADMIN_API_KEY"
```

**Expected Result:**
- Status: 200 OK
- Query count should be reset to 0

## Test 6: Query Period Reset

### 6.1 Test Automatic Period Reset
This test requires manipulating the database or waiting for natural period expiration.

```sql
-- Manually expire the query period to test reset logic
UPDATE "License" 
SET query_period_end = NOW() - INTERVAL '1 day'
WHERE license_key = '<your_license_key>';
```

Then make a search request - it should automatically reset the period and query count.

## Test 7: License Validation Endpoint

### 7.1 Test Public License Validation
```bash
# Should return license details
curl -X POST http://localhost:3000/api/licenses/validate \
  -H "Content-Type: application/json" \
  -d '{
    "license_key": "'$LICENSE_KEY'",
    "product_slug": "lumen-search-api"
  }'
```

**Expected Result:**
- Status: 200 OK
- `valid: true`
- License details included

## Test 8: Complete WordPress Plugin Flow

### 8.1 Simulate WordPress Plugin Request
```bash
# This simulates a complete WordPress plugin search request
curl -X POST http://localhost:3000/api/sites/$SITE_ID/search \
  -H "x-api-key: $API_KEY" \
  -H "X-License-Key: $LICENSE_KEY" \
  -H "User-Agent: WordPress/6.0; https://test.example.com" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "WordPress content search",
    "topK": 10
  }' \
  -v
```

**Expected Result:**
- Status: 200 OK
- All usage headers present
- Query tracked in database
- Results returned

## Validation Checklist

After running all tests, verify:

- [ ] License validation works correctly
- [ ] Query limits are enforced
- [ ] Usage headers are returned
- [ ] Agent access control works
- [ ] Query usage is tracked
- [ ] Period reset works automatically
- [ ] Admin endpoints work
- [ ] Error messages are informative
- [ ] Database records are created correctly

## Database Verification

Check that records are created in these tables:
- `License` - License records
- `QueryUsage` - Individual query tracking
- `ApiKey` - API key usage tracking

```sql
-- Check license record
SELECT * FROM "License" WHERE license_key = '<your_license_key>';

-- Check query usage records
SELECT * FROM "QueryUsage" WHERE license_id = '<your_license_id>' ORDER BY created_at DESC LIMIT 10;

-- Check API key usage
SELECT * FROM "ApiKey" WHERE key_prefix = '<your_api_key_prefix>';
```

## Performance Testing

For production readiness, also test:
1. Multiple concurrent requests
2. Rate limiting behavior
3. Database performance under load
4. Memory usage during query tracking

This comprehensive test suite validates that the licensing system is working correctly and ready for production use.