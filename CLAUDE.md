# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lumen Neural Search API is a multi-tenant SaaS platform providing semantic search capabilities for WordPress sites through vector embeddings. It's built with Node.js/TypeScript, Express.js, PostgreSQL with pgvector, and designed for serverless deployment on Vercel.

## Common Development Commands

```bash
# Development
npm run dev          # Start development server with hot reload
npm run typecheck    # Run TypeScript type checking (run after changes)

# Database operations
npm run db:generate  # Generate Prisma client after schema changes
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Prisma Studio for database inspection

# Production
npm run build        # Build for production (runs Prisma generate + TypeScript compile)
npm run start        # Start production server
```

## Architecture Overview

### Core Structure
- **src/controllers/**: HTTP request handlers for API endpoints
- **src/services/**: Business logic including embedding service, text chunking, WordPress integration
- **src/middleware/**: Authentication, rate limiting, query tracking
- **src/routes/**: API route definitions organized by feature (13 modules)
- **src/config/**: Database, environment, and pricing configuration

### Key Services
- **services/embedding.ts**: Hugging Face API integration for vector embeddings
- **services/textChunking.ts**: Intelligent text segmentation with sentence boundaries
- **services/unifiedSearch.ts**: Multi-type search orchestration across posts/products
- **services/wordpress/**: WordPress REST API integration and content processing

### Multi-Tenant Architecture
Complete data isolation between sites with user ownership validation at every data access point. Authentication uses JWT tokens + API keys + license validation.

### Database Schema
16 Prisma models with pgvector for semantic search. Core entities: Users, Sites, PostChunk, ProductEmbedding, Products, Licenses. All models include proper tenant isolation.

## Request Flow Pattern

Route → Middleware (auth/rate limiting) → Controller → Service → Database (Prisma)

## Environment Configuration

The application requires 20+ environment variables. Key categories:
- Database: Supabase connection and pgvector
- Authentication: JWT secrets and bcrypt
- AI Services: Hugging Face API tokens
- WordPress: REST API credentials
- CORS: Multiple environment origins

## Important Development Notes

### Database Connection Issues
**IMPORTANT**: The Supabase database often has connection issues from local development environments. When encountering database connection errors:

1. **DO NOT** repeatedly try `npm run db:push` - it uses the DIRECT_URL which often fails
2. **INSTEAD**, work with the existing schema - the pooled connection (DATABASE_URL) usually works fine for queries
3. **The SystemConfig table** may not exist yet - this is OK, the system handles it gracefully
4. **For schema changes**: These need to be applied through Supabase dashboard or wait for better connectivity

Common error patterns to ignore:
- "Can't reach database server at db.*.supabase.co:5432" - This is the direct connection, not critical
- "The table `public.system_config` does not exist" - Expected if schema hasn't been pushed
- These errors don't prevent the app from working with the pooled connection

### TypeScript Usage
All code is strictly typed. Always run `npm run typecheck` before committing changes.

### Database Changes
After modifying `prisma/schema.prisma`:
1. Run `npm run db:generate` to update Prisma client
2. Run `npm run db:push` to apply changes to database (Note: This may fail due to connection issues - see above)

### Vector Search Implementation
Uses pgvector with Prisma for semantic similarity. Search queries are processed through `services/unifiedSearch.ts` which handles both post content and WooCommerce products.

### WordPress Integration
Content ingestion happens through WordPress REST API with application password authentication. Text is chunked intelligently using sentence boundaries before embedding.

### Error Handling
All endpoints return structured error responses with proper HTTP codes. Use the established error patterns in existing controllers.

### Plugin Marketplace Features
The system includes a full plugin marketplace with license management, file storage via Supabase Storage, and download tracking. Product management follows the ecosystem patterns in `routes/ecosystem.ts`.

### Product Management
**SINGLE SOURCE OF TRUTH**: Products are defined in `src/config/products.config.json`
- Current products: AI Readiness Analysis ($19), Neural Search - Knowledge ($29), Neural Search - Product ($49)
- Products auto-initialize on first server startup if database is empty
- To reset products: `npm run db:reset-reinit` (this will delete ALL data)
- The SystemConfig table tracks initialization but may not exist - this is handled gracefully

## Functional Programming and TypeScript Guidelines

- Always defer to functional programming principles
- When using TypeScript:
  * Create strong types and avoid using "any"
  * Avoid type assertions where possible
  * Handle undefined cases explicitly instead of using bang operators (!) or optional chaining (?.)
  * Prefer functional pipelines over class-based approaches
  * Use callbacks instead of event-based prop passing when appropriate