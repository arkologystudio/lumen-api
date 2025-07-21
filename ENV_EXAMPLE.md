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

# reCAPTCHA (optional)
RECAPTCHA_SECRET=your-recaptcha-secret-here
RECAPTCHA_THRESHOLD=0.5

# CORS Origins
CORS_ORIGIN_DEV=http://localhost:3000
CORS_ORIGIN_PROD=https://your-production-domain.com
CORS_ORIGIN_STAGING=https://your-staging-domain.com
CORS_ORIGIN_DASHBOARD_DEV=http://localhost:3333

# Server API Key (for admin endpoints)
SERVER_API_KEY=your-secure-server-api-key-here
```

## Important Notes

1. **SUPABASE_URL**: Found in your Supabase project settings
2. **SUPABASE_SERVICE_ROLE_KEY**: Found in your Supabase project API settings (keep this secret!)
3. **DATABASE_URL**: Your Supabase PostgreSQL connection string with pgvector enabled
4. **JWT_SECRET**: Use a strong, random secret for production
5. **SERVER_API_KEY**: Use a secure API key for admin endpoints
6. **HUGGING_FACE_API_TOKEN**: Required for embedding generation
7. Make sure to add `.env` to your `.gitignore` file to avoid committing secrets

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