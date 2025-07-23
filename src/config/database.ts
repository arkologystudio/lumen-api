import { PrismaClient } from "@prisma/client";
import { ENV } from "./env";

// Global is used here to maintain a single instance across hot reloads in development
declare global {
  var __prisma: PrismaClient | undefined;
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 5000,  // 5 seconds
};

// Connection retry wrapper
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string = 'database operation'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Only retry on connection-related errors
      const isConnectionError = 
        error instanceof Error && 
        (error.message.includes("Can't reach database server") ||
         error.message.includes("connection") ||
         error.message.includes("timeout") ||
         error.message.includes("ECONNREFUSED") ||
         error.message.includes("ETIMEDOUT"));
      
      if (!isConnectionError || attempt === RETRY_CONFIG.maxRetries) {
        console.error(`${context} failed after ${attempt} attempts:`, error);
        throw error;
      }
      
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1),
        RETRY_CONFIG.maxDelay
      );
      
      console.warn(
        `${context} failed (attempt ${attempt}/${RETRY_CONFIG.maxRetries}), retrying in ${delay}ms...`,
        { error: error.message }
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Log connection mode for debugging
const connectionMode = ENV.DATABASE_URL.includes(':6543') ? 'transaction' : 'session';
const environmentType = ENV.IS_SERVERLESS ? 'serverless' : 'local';

console.log(`Database connection: ${environmentType} environment using ${connectionMode} mode`);

// Create Prisma client instance with enhanced configuration
export const prisma =
  globalThis.__prisma ||
  new PrismaClient({
    log: ENV.NODE_ENV === "development" 
      ? ["query", "error", "warn"] 
      : ["error"],
    errorFormat: "pretty",
    // Add datasource configuration for better connection handling
    datasources: {
      db: {
        url: ENV.DATABASE_URL,
      },
    },
    // Serverless-optimized configuration
    ...(ENV.IS_SERVERLESS && {
      transactionOptions: {
        timeout: 10000, // 10 seconds timeout for serverless
      },
    }),
  });

// Connection health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await withRetry(async () => {
      await prisma.$queryRaw`SELECT 1`;
    }, 'health check');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Enhanced disconnect with cleanup
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('Prisma client disconnected successfully');
  } catch (error) {
    console.error('Error disconnecting Prisma client:', error);
  }
}

// In development, save the instance to global to prevent creating multiple instances
if (ENV.NODE_ENV === "development") {
  globalThis.__prisma = prisma;
}

// Enhanced graceful shutdown with cleanup
const cleanup = async (signal: string) => {
  console.log(`Received ${signal}, cleaning up...`);
  await disconnectPrisma();
  process.exit(0);
};

process.on("SIGINT", () => cleanup("SIGINT"));
process.on("SIGTERM", () => cleanup("SIGTERM"));
process.on("beforeExit", async () => {
  await disconnectPrisma();
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await disconnectPrisma();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await disconnectPrisma();
  process.exit(1);
});

export default prisma;