#!/usr/bin/env ts-node

/**
 * Script to create the system_config table manually
 * This uses the pooled connection which works better in local environments
 */

import { prisma } from "../src/config/database";

async function createSystemConfigTable() {
  try {
    console.log("📦 Creating system_config table...");
    
    // Create the table using raw SQL
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS system_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(255) UNIQUE NOT NULL,
        value JSONB NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log("✅ system_config table created successfully!");
    
    // Create an update trigger for updated_at
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `;
    
    await prisma.$executeRaw`
      DROP TRIGGER IF EXISTS update_system_config_updated_at ON system_config;
    `;
    
    await prisma.$executeRaw`
      CREATE TRIGGER update_system_config_updated_at
      BEFORE UPDATE ON system_config
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `;
    
    console.log("✅ Updated_at trigger created successfully!");
    
    // Verify the table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_config'
      );
    `;
    
    console.log("✅ Table verification:", tableExists);
    
  } catch (error) {
    console.error("❌ Error creating system_config table:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createSystemConfigTable()
  .then(() => {
    console.log("✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });