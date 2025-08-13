/**
 * Database Management Service
 * Handles safe database reset and initialization with tracking
 */

import { prisma } from "../config/database";
import { initializeCompleteSystem } from "./ecosystemProductService";
import * as readline from "readline";

interface InitializationStatus {
  initialized: boolean;
  version: string;
  initializedAt: Date | null;
  lastReset: Date | null;
  environment: string;
}

/**
 * Check if the database has been initialized with products
 */
export const checkInitializationStatus = async (): Promise<InitializationStatus> => {
  try {
    // Check for initialization record
    const configRecord = await prisma.systemConfig.findUnique({
      where: { key: "products_initialized" }
    }).catch((error: any) => {
      // If table doesn't exist, return null
      if (error.code === 'P2021') {
        console.log("SystemConfig table doesn't exist yet. This is normal for first-time setup.");
        return null;
      }
      throw error;
    });

    if (configRecord) {
      const value = configRecord.value as any;
      return {
        initialized: true,
        version: value.version || "1.0.0",
        initializedAt: value.initializedAt ? new Date(value.initializedAt) : null,
        lastReset: value.lastReset ? new Date(value.lastReset) : null,
        environment: value.environment || "unknown"
      };
    }

    // Check if products exist (backward compatibility)
    const productCount = await prisma.product.count().catch(() => 0);
    if (productCount > 0) {
      // Products exist but no tracking record - create one if table exists
      try {
        await markAsInitialized("1.0.0", "migration");
      } catch (e) {
        // Table might not exist, that's ok
      }
      return {
        initialized: true,
        version: "1.0.0",
        initializedAt: new Date(),
        lastReset: null,
        environment: "migration"
      };
    }

    return {
      initialized: false,
      version: "0.0.0",
      initializedAt: null,
      lastReset: null,
      environment: process.env.NODE_ENV || "development"
    };
  } catch (error) {
    console.error("Error checking initialization status:", error);
    throw error;
  }
};

/**
 * Mark the database as initialized
 */
export const markAsInitialized = async (version: string, environment?: string): Promise<void> => {
  try {
    await prisma.systemConfig.upsert({
      where: { key: "products_initialized" },
      update: {
        value: {
          initialized: true,
          version,
          initializedAt: new Date().toISOString(),
          environment: environment || process.env.NODE_ENV || "development"
        }
      },
      create: {
        key: "products_initialized",
        value: {
          initialized: true,
          version,
          initializedAt: new Date().toISOString(),
          environment: environment || process.env.NODE_ENV || "development"
        },
        description: "Tracks whether products have been initialized from config"
      }
    }).catch((error: any) => {
      // If table doesn't exist, log warning but don't fail
      if (error.code === 'P2021') {
        console.log("⚠️  SystemConfig table doesn't exist. Run 'npm run db:push' to create it.");
        return;
      }
      throw error;
    });
    console.log("✅ Database marked as initialized");
  } catch (error) {
    console.error("Error marking database as initialized:", error);
    throw error;
  }
};

/**
 * Initialize products if not already initialized
 */
export const initializeProductsIfNeeded = async (): Promise<boolean> => {
  try {
    const status = await checkInitializationStatus();
    
    if (status.initialized) {
      console.log(`✅ Products already initialized (v${status.version}) on ${status.initializedAt}`);
      return false;
    }

    console.log("📦 No products found. Initializing from config...");
    await initializeCompleteSystem();
    await markAsInitialized("1.0.0");
    console.log("✅ Products initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Error initializing products:", error);
    throw error;
  }
};

/**
 * Reset the entire database (with confirmation)
 */
export const resetDatabase = async (skipConfirmation: boolean = false): Promise<void> => {
  try {
    if (!skipConfirmation) {
      const confirmed = await confirmAction(
        "⚠️  WARNING: This will DELETE ALL DATA in the database. Are you sure? (yes/no): "
      );
      if (!confirmed) {
        console.log("❌ Database reset cancelled");
        return;
      }
    }

    console.log("🗑️  Starting database reset...");
    
    // Clear all tables in reverse order of dependencies
    console.log("Clearing all data...");
    
    // Helper function to safely delete from a table
    const safeDelete = async (tableName: string, deleteOp: () => Promise<any>) => {
      try {
        await deleteOp();
      } catch (error: any) {
        if (error.code === 'P2021') {
          console.log(`Table ${tableName} doesn't exist, skipping...`);
        } else {
          throw error;
        }
      }
    };
    
    await safeDelete("queryUsage", () => prisma.queryUsage.deleteMany());
    await safeDelete("download", () => prisma.download.deleteMany());
    await safeDelete("pricingTier", () => prisma.pricingTier.deleteMany());
    await safeDelete("license", () => prisma.license.deleteMany());
    await safeDelete("activityLog", () => prisma.activityLog.deleteMany());
    await safeDelete("siteProduct", () => prisma.siteProduct.deleteMany());
    await safeDelete("productEmbedding", () => prisma.productEmbedding.deleteMany());
    await safeDelete("postChunk", () => prisma.postChunk.deleteMany());
    await safeDelete("embeddingJob", () => prisma.embeddingJob.deleteMany());
    await safeDelete("systemMetric", () => prisma.systemMetric.deleteMany());
    await safeDelete("billingEvent", () => prisma.billingEvent.deleteMany());
    await safeDelete("usageRecord", () => prisma.usageRecord.deleteMany());
    await safeDelete("apiKey", () => prisma.apiKey.deleteMany());
    await safeDelete("site", () => prisma.site.deleteMany());
    await safeDelete("product", () => prisma.product.deleteMany());
    await safeDelete("user", () => prisma.user.deleteMany());
    await safeDelete("systemConfig", () => prisma.systemConfig.deleteMany());
    
    console.log("✅ All data cleared");
    
    // Update the initialization tracking (only if table exists)
    try {
      await prisma.systemConfig.create({
        data: {
          key: "products_initialized",
          value: {
            initialized: false,
            version: "0.0.0",
            lastReset: new Date().toISOString(),
            environment: process.env.NODE_ENV || "development"
          },
          description: "Tracks whether products have been initialized from config"
        }
      });
    } catch (error: any) {
      if (error.code === 'P2021') {
        console.log("SystemConfig table doesn't exist, skipping tracking...");
      } else {
        throw error;
      }
    }

    console.log("✅ Database reset complete");
    console.log("💡 Run 'npm run db:init' to initialize products");
  } catch (error) {
    console.error("❌ Error resetting database:", error);
    throw error;
  }
};

/**
 * Reset and reinitialize the database
 */
export const resetAndReinitialize = async (skipConfirmation: boolean = false): Promise<void> => {
  try {
    await resetDatabase(skipConfirmation);
    console.log("\n🚀 Reinitializing products from config...");
    await initializeCompleteSystem();
    await markAsInitialized("1.0.0");
    console.log("✅ Database reset and reinitialized successfully");
  } catch (error) {
    console.error("❌ Error during reset and reinitialization:", error);
    throw error;
  }
};

/**
 * Force reinitialize products (overwrites existing)
 */
export const forceReinitializeProducts = async (): Promise<void> => {
  try {
    const confirmed = await confirmAction(
      "⚠️  This will overwrite existing products. Continue? (yes/no): "
    );
    if (!confirmed) {
      console.log("❌ Reinitialization cancelled");
      return;
    }

    console.log("🔄 Force reinitializing products...");
    
    // Clear existing products and related data
    await prisma.pricingTier.deleteMany();
    await prisma.siteProduct.deleteMany();
    await prisma.license.deleteMany();
    await prisma.product.deleteMany();
    
    // Reinitialize from config
    await initializeCompleteSystem();
    await markAsInitialized("1.0.0", "forced");
    
    console.log("✅ Products force reinitialized successfully");
  } catch (error) {
    console.error("❌ Error force reinitializing products:", error);
    throw error;
  }
};

/**
 * Get database statistics
 */
export const getDatabaseStats = async (): Promise<any> => {
  try {
    const stats = {
      users: await prisma.user.count(),
      sites: await prisma.site.count(),
      products: await prisma.product.count(),
      pricingTiers: await prisma.pricingTier.count(),
      licenses: await prisma.license.count(),
      postChunks: await prisma.postChunk.count(),
      productEmbeddings: await prisma.productEmbedding.count(),
      apiKeys: await prisma.apiKey.count(),
      initialization: await checkInitializationStatus()
    };
    
    return stats;
  } catch (error) {
    console.error("Error getting database stats:", error);
    throw error;
  }
};

/**
 * Helper function to confirm dangerous actions
 */
const confirmAction = (prompt: string): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
    });
  });
};

/**
 * Export all functions for use in CLI and API
 */
export default {
  checkInitializationStatus,
  initializeProductsIfNeeded,
  resetDatabase,
  resetAndReinitialize,
  forceReinitializeProducts,
  getDatabaseStats,
  markAsInitialized
};