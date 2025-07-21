# Lumen Neural Search API

## Overview
This service provides semantic search capabilities for multiple WordPress sites through vector embeddings. The system uses Supabase for all data storage needs - PostgreSQL with pgvector for embeddings, and Supabase Storage for file management.

## System Architecture

The service is built with modern, cloud-native technologies:

- **Express.js Application**: A Node.js backend service built with TypeScript
- **Supabase Database**: PostgreSQL with pgvector extension for vector embeddings
- **Supabase Storage**: Object storage for plugin files and assets
- **Vercel**: Serverless deployment platform (hobby tier compatible)

## Features

### 🔍 Neural Search
- Semantic search across WordPress content using vector embeddings
- Multi-site support with data isolation
- Real-time search with relevance scoring

### 🏪 Plugin Marketplace
- Ecosystem product management
- Plugin file storage and distribution
- License management and validation

### 🎯 Free Tier Compatible
- Supabase free tier: 500MB database + 1GB storage
- Vercel hobby plan: Free serverless functions
- Hugging Face: Free embedding API

## Quick Start

### 1. Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Enable the pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Copy your project credentials

### 2. Environment Configuration

Create a `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Embedding Configuration
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
INFERENCE_PROVIDER=huggingface
HUGGING_FACE_API_TOKEN=your-token-here
THRESHOLD=0.7

# Authentication
JWT_SECRET=your-jwt-secret
JWT_TTL=3600
SERVER_API_KEY=your-secure-api-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=10

# CORS Origins
CORS_ORIGIN_DEV=http://localhost:3000
CORS_ORIGIN_PROD=https://your-production-domain.com
```

### 3. Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Start development server
npm run dev
```

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Add environment variables in Vercel dashboard
```

## API Endpoints

### Authentication

The API uses JWT-based authentication for users and API key authentication for server-to-server communication.

#### Headers
- **User Auth**: `Authorization: Bearer <jwt-token>`
- **API Key Auth**: `X-API-Key: <your-api-key>`

### Core Endpoints

#### POST `/api/auth/register`
Register a new user account.

#### POST `/api/auth/login`
Authenticate and receive JWT token.

#### POST `/api/sites`
Create a new site for embedding.

#### POST `/api/sites/:site_id/embed`
Embed WordPress content for semantic search.

#### POST `/api/sites/:site_id/search`
Search within a specific site's content.

### Product & License Endpoints

#### GET `/api/ecosystem-products`
List available ecosystem products.

#### POST `/api/licenses`
Create a new product license.

#### GET `/api/downloads/:download_id`
Download plugin files with license validation.

## Data Processing Pipeline

### 1. Content Ingestion
- WordPress plugin sends chunked post data
- API validates and reconstructs full content
- Extracts clean text from HTML

### 2. Text Chunking
- Intelligent chunking with sentence boundary detection
- Configurable chunk size (default: 1000 characters)
- Overlap between chunks for context preservation

### 3. Vector Embedding
- Generates embeddings using Hugging Face models
- Stores vectors in Supabase PostgreSQL with pgvector
- Enables semantic similarity search

### 4. Search & Retrieval
- Cosine similarity search using pgvector operators
- Configurable similarity threshold
- Returns ranked results with relevance scores

## Database Schema

### Core Tables
- **users**: User accounts and authentication
- **sites**: WordPress site registrations
- **post_chunks**: Text chunks with vector embeddings
- **product_embeddings**: WooCommerce product vectors

### Product Management
- **ecosystem_products**: Available products/plugins
- **licenses**: User product licenses
- **downloads**: Download tracking and validation

## File Storage

Plugin files are stored in Supabase Storage with:
- Private buckets for security
- Automatic file integrity verification
- Signed URLs for temporary access
- 50MB file size limit

## Free Tier Limits

### Supabase (Free)
- **Database**: 500MB PostgreSQL with pgvector
- **Storage**: 1GB for plugin files
- **API Requests**: 50,000/month

### Vercel (Hobby)
- **Functions**: 100GB-hours/month
- **Bandwidth**: 100GB/month
- **Custom domains**: Included

### Hugging Face (Free)
- **Inference API**: Rate-limited but free
- **Models**: Access to open-source embedding models

## Security Features

### Data Protection
- JWT-based authentication with secure tokens
- API key validation for server access
- Rate limiting on search endpoints
- SQL injection prevention with Prisma

### Multi-Tenancy
- Complete data isolation between sites
- User ownership validation
- Secure file access with signed URLs

## Performance Optimizations

### Vector Search
- Optimized pgvector queries with proper indexing
- Configurable similarity thresholds
- Batch processing for embedding generation

### Caching
- Prisma connection pooling
- Static file serving via Supabase CDN
- Client-side caching headers

## Development

### Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes
npm run db:studio    # Open database GUI
```

### Project Structure
```
src/
├── controllers/     # Request handlers
├── services/        # Business logic
├── middleware/      # Auth, rate limiting
├── routes/          # API routing
├── types/           # TypeScript types
└── config/          # Environment config
```

## Deployment

### Environment Variables (Vercel)
Set these in your Vercel dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `JWT_SECRET`
- `SERVER_API_KEY`
- `HUGGING_FACE_API_TOKEN`

### Build Configuration
The `vercel.json` file is preconfigured for:
- TypeScript compilation
- Prisma client generation
- Serverless function optimization

## Support

- **Documentation**: See `ENV_EXAMPLE.md` for setup details
- **Database GUI**: Use `npm run db:studio`
- **Logs**: Monitor via Vercel dashboard

## License

MIT License - see LICENSE file for details.