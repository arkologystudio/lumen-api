# Environment Variables Configuration

Create a `.env` file in the root directory with the following variables:

```bash
# Node Environment
NODE_ENV=development

# Server Configuration
PORT=3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_TTL=3600

# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Embedding Configuration
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
INFERENCE_PROVIDER=huggingface
HUGGING_FACE_API_TOKEN=your-huggingface-token-here
THRESHOLD=0.7

# WordPress Configuration (optional)
WP_API_URL=https://your-wordpress-site.com/wp-json/wp/v2
WP_APPLICATION_PASS_NAME=your-app-name
WP_APPLICATION_PASS_PASSWORD=your-app-password

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=10


# CORS Origins
CORS_ORIGIN_DEV=http://localhost:3000
CORS_ORIGIN_PROD=https://your-production-domain.com
CORS_ORIGIN_STAGING=https://your-staging-domain.com
CORS_ORIGIN_DASHBOARD_DEV=http://localhost:3333

# API Keys
# Legacy server API key (for backward compatibility)
SERVER_API_KEY=your-secure-server-api-key-here

# Admin API key (for admin-only endpoints)
# Falls back to SERVER_API_KEY if not set
ADMIN_API_KEY=your-secure-admin-api-key-here
```

## API Key Types

The system supports three types of API authentication:

### 1. Admin API Key (`ADMIN_API_KEY`)
- **Purpose**: Admin-only operations (user management, system stats, license management)
- **Header**: `x-admin-key: your-admin-key` or `x-api-key: your-admin-key`
- **Routes**: `/api/admin/*`, admin license endpoints, admin purchase endpoints
- **Fallback**: Uses `SERVER_API_KEY` if `ADMIN_API_KEY` is not set

### 2. Scoped Database API Keys
- **Purpose**: User-specific API access with granular permissions
- **Header**: `x-api-key: your-scoped-api-key`
- **Scopes**: `['search', 'embed', 'admin']`
- **Routes**: Embedding endpoints, user API access
- **Management**: Created and managed through the user dashboard

### 3. Legacy Server API Key (`SERVER_API_KEY`)
- **Purpose**: Backward compatibility
- **Header**: `x-api-key: your-server-key`
- **Usage**: Legacy endpoints and fallback authentication

## Important Notes

1. **SUPABASE_URL**: Found in your Supabase project settings
2. **SUPABASE_SERVICE_ROLE_KEY**: Found in your Supabase project API settings (keep this secret!)
3. **DATABASE_URL**: Your Supabase PostgreSQL connection string with pgvector enabled
4. **JWT_SECRET**: Use a strong, random secret for production
5. **ADMIN_API_KEY**: Use a secure API key for admin endpoints (different from SERVER_API_KEY)
6. **HUGGING_FACE_API_TOKEN**: Required for embedding generation
7. Make sure to add `.env` to your `.gitignore` file to avoid committing secrets

## API Key Security Best Practices

- Use different keys for admin vs regular API access
- Rotate API keys regularly
- Use scoped database API keys for user-facing API access
- Monitor API key usage through the admin dashboard
- Set appropriate rate limits for each API key type

## Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Enable the pgvector extension in your database:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Copy your project URL and service role key to your `.env` file
4. The plugin storage bucket will be created automatically on first run

## Free Tier Limits

This configuration uses only free services:
- **Supabase**: 500MB database + 1GB storage (free tier)
- **Hugging Face**: Free inference API
- **Vercel**: Free hosting for the API (hobby plan) 