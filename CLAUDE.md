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

### TypeScript Usage
All code is strictly typed. Always run `npm run typecheck` before committing changes.

### Database Changes
After modifying `prisma/schema.prisma`:
1. Run `npm run db:generate` to update Prisma client
2. Run `npm run db:push` to apply changes to database

### Vector Search Implementation
Uses pgvector with Prisma for semantic similarity. Search queries are processed through `services/unifiedSearch.ts` which handles both post content and WooCommerce products.

### WordPress Integration
Content ingestion happens through WordPress REST API with application password authentication. Text is chunked intelligently using sentence boundaries before embedding.

### Error Handling
All endpoints return structured error responses with proper HTTP codes. Use the established error patterns in existing controllers.

### Plugin Marketplace Features
The system includes a full plugin marketplace with license management, file storage via Supabase Storage, and download tracking. Product management follows the ecosystem patterns in `routes/ecosystem.ts`.

## Functional Programming and TypeScript Guidelines

- Always defer to functional programming principles
- When using TypeScript:
  * Create strong types and avoid using "any"
  * Avoid type assertions where possible
  * Handle undefined cases explicitly instead of using bang operators (!) or optional chaining (?.)
  * Prefer functional pipelines over class-based approaches
  * Use callbacks instead of event-based prop passing when appropriate