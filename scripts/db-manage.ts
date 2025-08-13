#!/usr/bin/env ts-node

/**
 * Database Management CLI
 * Provides commands for managing the database safely
 */

import { program } from "commander";
import {
  checkInitializationStatus,
  initializeProductsIfNeeded,
  resetDatabase,
  resetAndReinitialize,
  forceReinitializeProducts,
  getDatabaseStats
} from "../src/services/databaseManagement";
import { prisma } from "../src/config/database";

// Set up CLI program
program
  .name("db-manage")
  .description("Database management CLI for Lighthouse API")
  .version("1.0.0");

// Status command
program
  .command("status")
  .description("Check database initialization status and statistics")
  .action(async () => {
    try {
      console.log("🔍 Checking database status...\n");
      
      const status = await checkInitializationStatus();
      const stats = await getDatabaseStats();
      
      console.log("=== Initialization Status ===");
      console.log(`Initialized: ${status.initialized ? "✅ Yes" : "❌ No"}`);
      console.log(`Version: ${status.version}`);
      console.log(`Initialized At: ${status.initializedAt || "Never"}`);
      console.log(`Last Reset: ${status.lastReset || "Never"}`);
      console.log(`Environment: ${status.environment}`);
      
      console.log("\n=== Database Statistics ===");
      console.log(`Users: ${stats.users}`);
      console.log(`Sites: ${stats.sites}`);
      console.log(`Products: ${stats.products}`);
      console.log(`Pricing Tiers: ${stats.pricingTiers}`);
      console.log(`Licenses: ${stats.licenses}`);
      console.log(`Post Chunks: ${stats.postChunks}`);
      console.log(`Product Embeddings: ${stats.productEmbeddings}`);
      console.log(`API Keys: ${stats.apiKeys}`);
      
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error("❌ Error:", error);
      await prisma.$disconnect();
      process.exit(1);
    }
  });

// Initialize command
program
  .command("init")
  .description("Initialize products from config if not already initialized")
  .action(async () => {
    try {
      console.log("🚀 Initializing products...\n");
      
      const wasInitialized = await initializeProductsIfNeeded();
      
      if (wasInitialized) {
        console.log("✅ Products initialized successfully from config");
      } else {
        console.log("ℹ️  Products were already initialized");
      }
      
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error("❌ Error:", error);
      await prisma.$disconnect();
      process.exit(1);
    }
  });

// Reset command
program
  .command("reset")
  .description("Reset the entire database (WARNING: Deletes all data)")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (options) => {
    try {
      console.log("🗑️  Database reset requested\n");
      
      await resetDatabase(options.yes);
      
      console.log("\n✅ Database reset complete");
      console.log("💡 Run 'npm run db:init' to initialize products");
      
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error("❌ Error:", error);
      await prisma.$disconnect();
      process.exit(1);
    }
  });

// Reset and reinitialize command
program
  .command("reset-reinit")
  .description("Reset database and reinitialize with products from config")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (options) => {
    try {
      console.log("🔄 Reset and reinitialize requested\n");
      
      await resetAndReinitialize(options.yes);
      
      console.log("\n✅ Database reset and reinitialized successfully");
      
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error("❌ Error:", error);
      await prisma.$disconnect();
      process.exit(1);
    }
  });

// Force reinitialize command
program
  .command("force-reinit")
  .description("Force reinitialize products (overwrites existing)")
  .action(async () => {
    try {
      console.log("⚡ Force reinitialize products requested\n");
      
      await forceReinitializeProducts();
      
      console.log("\n✅ Products force reinitialized successfully");
      
      await prisma.$disconnect();
      process.exit(0);
    } catch (error) {
      console.error("❌ Error:", error);
      await prisma.$disconnect();
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}