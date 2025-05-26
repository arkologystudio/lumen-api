# Multi-Site Embedding API

## Overview
This service provides semantic search capabilities for multiple WordPress sites through vector embeddings. Each site gets its own isolated collection in the vector database, enabling secure multi-tenant operation.

## System Architecture

The service consists of several key components:

- **Express.js Application**: A Node.js backend service built with TypeScript
- **Milvus**: Vector database for storing and searching embedded content (one collection per site)
- **MinIO**: Object storage for managing large files and binary data
- **etcd**: Key-value store used by Milvus for metadata management

## Multi-Site Features

### Site Isolation
- Each site gets a dedicated Milvus collection: `site_{site_id}_chunks`
- Complete data isolation between sites
- Independent scaling and management per site

### Site Management
- List all registered sites
- Get site-specific statistics
- Drop site collections for cleanup
- On-demand collection creation

## Prerequisites

- Docker and Docker Compose
- Node.js 18+
- Environment variables setup (see Configuration section)

## Configuration

Create a `.env` file with the following variables:

```env
# Milvus Configuration
MILVUS_ADDRESS=standalone:19530
MILVUS_USERNAME=
MILVUS_PASSWORD=

# Embedding Configuration
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
INFERENCE_PROVIDER=huggingface
HUGGING_FACE_API_TOKEN=your_token_here
THRESHOLD=0.7

# Authentication
JWT_SECRET=your_jwt_secret
JWT_TTL=24h
SERVER_API_KEY=your_server_api_key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# CORS Origins
CORS_ORIGIN_DEV=http://localhost:3000
CORS_ORIGIN_PROD=https://your-production-domain.com
CORS_ORIGIN_STAGING=https://your-staging-domain.com

# reCAPTCHA
RECAPTCHA_SECRET=your_recaptcha_secret
RECAPTCHA_THRESHOLD=0.5

# Docker
DOCKER_VOLUME_DIRECTORY=./
```

## Installation & Setup

### Local Development

For local development, start the core services:

```bash
docker-compose up -d
```

This will start:
- Milvus standalone server (port 19530)
- MinIO (port 9000)
- Express application (port 3000)

### Production Deployment

For production deployment with nginx proxy:

```bash
docker-compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d
```

This additionally includes:
- **nginx**: Reverse proxy server (port 80)

## API Endpoints

### Authentication

The API uses two authentication methods:

1. **JWT Authentication** (for client applications)
   - Used for search endpoints
   - Include `Authorization: Bearer <token>` header

2. **API Key Authentication** (for server-to-server)
   - Used for embedding and management endpoints
   - Include `X-API-Key: <your_api_key>` header

### Search Endpoints

#### POST `/api/embedding/search`
Search for similar content within a specific site.

**Authentication**: JWT Required

**Request Body**:
```json
{
  "query": "search query text",
  "site_id": "your-site-id",
  "topK": 10
}
```

**Response**:
```json
{
  "success": true,
  "results": [
    {
      "postId": 123,
      "postTitle": "Post Title",
      "postUrl": "https://site.com/post",
      "siteId": "your-site-id",
      "siteName": "Your Site",
      "siteUrl": "https://site.com",
      "averageScore": 0.85,
      "maxScore": 0.92,
      "totalChunks": 3,
      "chunks": [
        {
          "chunkId": "your-site-id-123-chunk-0",
          "chunkIndex": 0,
          "content": "Relevant content chunk...",
          "score": 0.92
        }
      ]
    }
  ],
  "site_id": "your-site-id",
  "totalPosts": 1,
  "totalChunks": 3
}
```

### Embedding Endpoints

#### POST `/api/embedding/embed-test`
Process and embed content from a WordPress site.

**Authentication**: API Key Required

**Request Body**:
```json
{
  "site_id": "your-site-id",
  "site_name": "Your Site Name",
  "site_url": "https://your-site.com",
  "posts": [
    {
      "id": 123,
      "type": "post",
      "title": "Post Title",
      "content": "<p>HTML content...</p>",
      "url": "https://your-site.com/post",
      "site_id": "your-site-id",
      "site_name": "Your Site Name",
      "site_url": "https://your-site.com"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully processed batch request...",
  "originalPostCount": 1,
  "reconstructedPostCount": 1,
  "processedPostCount": 1,
  "overallStats": {
    "totalWordCount": 500,
    "totalCharacterCount": 3000,
    "totalParagraphCount": 10,
    "averageWordsPerPost": 500,
    "averageParagraphsPerPost": 10
  },
  "chunkingStats": {
    "totalChunks": 3,
    "averageChunkSize": 950,
    "chunksPerPost": { "123": 3 },
    "sentenceCompleteness": 85
  },
  "logFiles": {
    "mainRequest": "logs/embed-batch-request-your-site-id-timestamp.json",
    "chunks": "logs/chunks-your-site-id-timestamp.json",
    "embeddings": "logs/embeddings-your-site-id-timestamp.json"
  }
}
```

### Site Management Endpoints

#### GET `/api/embedding/sites`
List all registered sites.

**Authentication**: API Key Required

**Response**:
```json
{
  "success": true,
  "sites": [
    {
      "site_id": "site-1",
      "site_name": "site-1",
      "site_url": "",
      "collection_name": "site_site_1_chunks",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z",
      "chunk_count": 150
    }
  ],
  "total": 1
}
```

#### GET `/api/embedding/sites/:site_id/stats`
Get statistics for a specific site.

**Authentication**: API Key Required

**Response**:
```json
{
  "success": true,
  "stats": {
    "siteId": "your-site-id",
    "collectionName": "site_your_site_id_chunks",
    "chunkCount": 150,
    "exists": true
  }
}
```

#### GET `/api/embedding/sites/:site_id/count`
Get chunk count for a specific site.

**Authentication**: API Key Required

**Response**:
```json
{
  "success": true,
  "site_id": "your-site-id",
  "count": 150
}
```

#### DELETE `/api/embedding/sites/:site_id/collection`
Drop the collection for a specific site (removes all data).

**Authentication**: API Key Required

**Response**:
```json
{
  "success": true,
  "message": "Site collection dropped for site: your-site-id",
  "site_id": "your-site-id"
}
```

## Text Processing Pipeline

### 1. Content Reconstruction
- Handles chunked posts from WordPress plugin
- Validates all chunks are present
- Reconstructs full content from chunks

### 2. Text Extraction
- Removes HTML markup and unwanted elements
- Extracts clean, natural language text
- Preserves paragraph structure

### 3. Intelligent Chunking
- Default 1000 character chunks with 200 character overlap
- Sentence boundary detection with abbreviation handling
- Paragraph boundary preference
- Complete sentence enforcement
- Statistics tracking including sentence completeness

### 4. Vector Embedding
- Uses configurable embedding models
- Batch processing for efficiency
- Comprehensive logging and error handling

## Data Structure

### Site Collections
Each site gets a dedicated Milvus collection with the following schema:

- `pk_id`: Auto-generated primary key
- `chunk_id`: Unique chunk identifier
- `post_id`: WordPress post ID
- `post_title`: Post title
- `post_url`: Post URL
- `site_id`: Site identifier
- `site_name`: Site name
- `site_url`: Site URL
- `chunk_index`: Chunk position within post
- `content`: Text content
- `embedding`: 1024-dimensional vector

### Collection Naming
Collections are named using the pattern: `site_{sanitized_site_id}_chunks`

Site IDs are sanitized by replacing non-alphanumeric characters with underscores.

## Logging

The system generates comprehensive logs for debugging and analysis:

### Log Files
- `embed-batch-request-{site_id}-{timestamp}.json`: Main request processing log
- `chunks-{site_id}-{timestamp}.json`: Detailed chunking analysis
- `embeddings-{site_id}-{timestamp}.json`: Embedding vectors and metadata

### Log Content
- Request metadata and processing statistics
- Text extraction and chunking metrics
- Embedding dimensions and vectors
- Error tracking and performance metrics

## Development

The application supports hot-reloading for development:
- Source code is mounted to `/app/src` in the container
- Changes to TypeScript files automatically trigger recompilation
- The Express server runs in development mode with `ts-node-dev`

## Infrastructure Details

### Docker Services
- **express-app**: Main application service with Node.js 18
- **milvus-standalone**: Vector database for semantic search
- **minio**: Object storage service
- **etcd**: Key-value store for Milvus metadata
- **nginx** (production only): Reverse proxy and load balancer

### Networking
All services are connected through the `milvus-net` Docker network.

### Persistence
Data is persisted through Docker volumes:
- `/volumes/milvus`: Milvus data
- `/volumes/minio`: MinIO data
- `/volumes/etcd`: etcd data
- `./logs`: Application logs (mounted from host)

## Error Handling

The API provides detailed error responses:

### Common Error Codes
- `400`: Bad Request (missing parameters, invalid format)
- `401`: Unauthorized (invalid JWT token)
- `403`: Forbidden (invalid API key)
- `404`: Not Found (site not embedded, no results)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error (processing failures)

### Error Response Format
```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": "ERROR_CODE_OR_DETAILS"
}
```

## Security

### Multi-Tenancy
- Complete data isolation between sites
- Site-specific collections prevent data leakage
- Parameterized queries prevent injection attacks

### Authentication
- JWT tokens for client authentication
- API keys for server-to-server communication
- Rate limiting to prevent abuse

### Input Validation
- Request body validation
- Site ID sanitization
- Content size limits (50MB max)

## Performance

### Optimization Features
- Batch processing for embeddings
- Connection pooling for Milvus
- Efficient chunking algorithms
- Cosine similarity search with IVF_FLAT indexing

### Scaling Considerations
- Each site collection scales independently
- Horizontal scaling through multiple API instances
- Milvus clustering for large deployments

## Monitoring

### Health Checks
- Collection existence validation
- Embedding service connectivity
- Database connection status

### Metrics
- Processing time per request
- Chunk count per site
- Search performance statistics
- Error rates and types

---

For detailed implementation specifics, refer to the source code in:
- `/src/services/multiSiteVectorStore.ts`: Multi-site vector operations
- `/src/services/textChunking.ts`: Text processing and chunking
- `/src/controllers/embeddingController.ts`: API endpoint handlers
- `/src/routes/embeddingRoutes.ts`: Route definitions