/**
 * Type declarations for Prisma Client
 * This file helps TypeScript recognize new Prisma models
 */

import { PrismaClient as GeneratedPrismaClient } from '@prisma/client';

declare module '@prisma/client' {
  interface PrismaClient extends GeneratedPrismaClient {
    systemConfig: any; // This ensures TypeScript knows systemConfig exists
  }
}

// Re-export to ensure the types are loaded
export * from '@prisma/client';