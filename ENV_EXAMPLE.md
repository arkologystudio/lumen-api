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

# Database Configuration
DATABASE_URL=postgresql://lumen:lumen_password@postgres:5432/lumen?schema=public

# Milvus Vector Database
MILVUS_ADDRESS=standalone:19530
MILVUS_USERNAME=
MILVUS_PASSWORD=

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

1. **DATABASE_URL**: This should match your PostgreSQL configuration in docker-compose.yaml
2. **JWT_SECRET**: Use a strong, random secret for production
3. **SERVER_API_KEY**: Use a secure API key for admin endpoints
4. **HUGGING_FACE_API_TOKEN**: Optional, only needed if using Hugging Face inference API
5. Make sure to add `.env` to your `.gitignore` file to avoid committing secrets 