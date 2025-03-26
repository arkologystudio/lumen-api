# Curriculum Embedding Service

## Overview
This service is designed to process and index curriculum content from culturehack.io, enabling semantic search capabilities through vector embeddings. The service uses a modern stack including Express.js, Milvus (vector database), MariaDB, and MinIO for object storage.

## System Architecture

The service consists of several key components:

- **Express.js Application**: A Node.js backend service built with TypeScript
- **Milvus**: Vector database for storing and searching embedded curriculum content
- **MariaDB**: Relational database for storing metadata and relationships
- **MinIO**: Object storage for managing large files and binary data
- **etcd**: Key-value store used by Milvus for metadata management

## Prerequisites

- Docker and Docker Compose
- Node.js 18+
- Environment variables setup (see Configuration section)

## Configuration

Create a `.env` file with the following variables:

```env
DB_PASSWORD=your_password
DB_NAME=your_database_name
DB_HOST=mariadb
DB_USER=root
DOCKER_VOLUME_DIRECTORY=./
```

## Installation & Setup

1. Clone the repository:
```bash
git clone [repository-url]
cd curriculum-embedding-service
```

2. Start the services:
```bash
docker-compose up -d
```

This will start:
- Milvus standalone server (port 19530)
- MariaDB (port 3306)
- MinIO (port 9000)
- Express application (port 3000)

## Development

The application is set up with hot-reloading for development:
- Source code is mounted to `/app/src` in the container
- Changes to TypeScript files will automatically trigger recompilation
- The Express server runs in development mode with `ts-node-dev`

## Infrastructure Details

### Docker Services

- **express-app**: Main application service with Node.js 18
- **milvus-standalone**: Vector database for semantic search
- **mariadb**: Relational database for structured data
- **minio**: Object storage service
- **etcd**: Key-value store for Milvus metadata

### Networking

All services are connected through the `milvus-net` Docker network, enabling seamless communication between containers.

### Persistence

Data is persisted through Docker volumes:
- `/volumes/milvus`: Milvus data
- `/volumes/mariadb`: MariaDB data
- `/volumes/minio`: MinIO data
- `/volumes/etcd`: etcd data

## Note

For more detailed information about the implementation specifics, including:
- API endpoints
- Embedding generation process
- Search functionality
- Database schema

Please refer to the source code documentation in the `/src` directory.

---

For detailed code implementation and specific functionality, you may want to explore the source code in the following directories:
- `/src/services`
- `/src/routes`
- `/src/controllers`
- `/src/config`