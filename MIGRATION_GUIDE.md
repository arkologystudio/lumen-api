# Migration Guide: PostgreSQL + Prisma Integration

## Overview

This migration adds PostgreSQL with Prisma for relational data management while keeping Milvus for vector embeddings. The system now provides:

- **PostgreSQL + Prisma**: User accounts, site management, metadata
- **Milvus Vector Store**: Embeddings and similarity search
- **Proper Authentication**: JWT-based user authentication
- **Multi-tenant Architecture**: Users can own multiple sites

## What Changed

### 1. Database Architecture
```
Old: In-memory storage (Map objects)
New: PostgreSQL with Prisma ORM
```

### 2. New Database Schema
- **users**: User accounts with authentication
- **sites**: Site registration and metadata
- **embedding_jobs**: Optional tracking of embedding operations

### 3. Enhanced API Structure
```
/api/auth/          - User registration & login
/api/users/         - User profile management  
/api/sites/         - Site CRUD operations
/api/admin/         - Admin functions (API key protected)
/api/embedding/     - Legacy endpoints (backward compatible)
```

## Setup Instructions

### 1. Environment Configuration
Create a `.env` file with the database URL:
```bash
DATABASE_URL=postgresql://lumen:lumen_password@postgres:5432/lumen?schema=public
```
See `ENV_EXAMPLE.md` for all required variables.

### 2. Start the Application
```bash
# Start with Docker Compose (includes PostgreSQL)
docker-compose up --build

# Or manually:
npm run db:push    # Push schema to database
npm run dev        # Start development server
```

### 3. Database Operations
```bash
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema changes
npm run db:migrate   # Create migration files
npm run db:studio    # Open Prisma Studio (GUI)
npm run db:reset     # Reset database (dev only)
```

## API Usage Examples

### 1. User Registration & Authentication
```typescript
// Register new user
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123',
    name: 'John Doe'
  })
});

const { data: { user, token } } = await response.json();
```

### 2. Site Management
```typescript
// Create a site
const siteResponse = await fetch('/api/sites', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'My Website',
    url: 'https://mywebsite.com',
    description: 'My personal blog'
  })
});

const { data: site } = await siteResponse.json();
```

### 3. Content Embedding
```typescript
// Embed content for a site
await fetch(`/api/sites/${site.id}/embed`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    posts: [/* your post data */]
  })
});
```

### 4. Search Content
```typescript
// Search within a site
const searchResponse = await fetch(`/api/sites/${site.id}/search`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    query: 'machine learning',
    topK: 10
  })
});

const { data: results } = await searchResponse.json();
```

## Data Persistence

### User Data
- **Secure**: Passwords hashed with bcrypt (12 rounds)
- **Validated**: Email format and password strength validation
- **Indexed**: Efficient queries on email and user ID

### Site Data
- **URL Uniqueness**: Each site URL can only be registered once
- **User Ownership**: Sites are tied to specific users
- **Cascade Deletion**: Deleting a user removes all their sites
- **Status Tracking**: Embedding status and metadata tracking

### Vector Store Integration
- **Automatic Collection Creation**: Site registration creates Milvus collection
- **Collection Naming**: `site_{site_id}_chunks` pattern
- **Cleanup**: Site deletion removes vector collection
- **Interoperability**: Site ID links PostgreSQL records to Milvus collections

## Security Features

### Authentication
- **JWT Tokens**: Secure, stateless authentication
- **Password Hashing**: bcrypt with salt rounds
- **Token Verification**: Middleware for protected routes

### Authorization
- **User Ownership**: Users can only access their own sites
- **Admin Functions**: API key protected admin endpoints
- **Rate Limiting**: Search endpoints have rate limiting

### Data Validation
- **Input Sanitization**: URL validation and normalization
- **Type Safety**: Strong TypeScript typing throughout
- **Error Handling**: Consistent error responses

## Migration Checklist

- [ ] Set up environment variables (see `ENV_EXAMPLE.md`)
- [ ] Start PostgreSQL with Docker Compose
- [ ] Run `npx prisma generate` to create client
- [ ] Run `npx prisma db push` to create tables
- [ ] Test user registration endpoint
- [ ] Test site creation and management
- [ ] Test embedding and search functionality
- [ ] Verify admin endpoints work with API key
- [ ] Check vector store integration

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View PostgreSQL logs
docker logs lumen-postgres

# Reset database if needed
npm run db:reset
```

### Prisma Issues
```bash
# Regenerate Prisma client
npm run db:generate

# Check database status
npx prisma db pull
```

### Vector Store Issues
```bash
# Check Milvus connection
docker logs milvus-standalone

# Check collection creation
# Collections are created automatically when sites are registered
```

## Performance Considerations

1. **Database Indexing**: Proper indexes on frequently queried fields
2. **Connection Pooling**: Prisma handles connection pooling automatically
3. **Vector Store**: Milvus collections are created on-demand
4. **Caching**: Consider adding Redis for session management in production

## Production Deployment

1. Use environment-specific database URLs
2. Enable SSL for database connections
3. Set up proper backup strategies for PostgreSQL
4. Configure proper logging and monitoring
5. Use connection pooling for high-traffic scenarios

## Backward Compatibility

The legacy `/api/embedding/*` endpoints remain functional for existing integrations. However, new projects should use the structured endpoints under `/api/users/` and `/api/sites/`.

## Next Steps

1. Set up your environment and test the new API
2. Migrate any existing integrations to use user authentication
3. Consider implementing additional features like team management
4. Set up monitoring and logging for production use 