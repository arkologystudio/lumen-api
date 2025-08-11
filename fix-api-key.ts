import { prisma } from "./src/config/database";
import crypto from "crypto";

async function fixApiKey() {
  try {
    // The API key from the frontend
    const apiKeyFromFrontend = "619370e277a3044eab05bc9e6bd75fa08405938b6a3ff50c7dc774fcefd47d4e";
    const keyPrefix = apiKeyFromFrontend.substring(0, 8); // "619370e2"
    const keyHash = crypto.createHash('sha256').update(apiKeyFromFrontend).digest('hex');
    
    console.log("🔧 Fixing API key issue...\n");
    console.log("API Key from frontend:", apiKeyFromFrontend);
    console.log("Key Prefix:", keyPrefix);
    console.log("SHA256 Hash:", keyHash);
    
    // Delete the old API key created by our script
    await prisma.apiKey.deleteMany({
      where: { 
        site_id: "c9b9f11e-7ab4-4c1d-a306-cce52ceb4657"
      }
    });
    console.log("\n✅ Deleted old API keys");
    
    // Get the user
    const user = await prisma.user.findUnique({
      where: { email: "che@che.com" }
    });
    
    if (!user) {
      console.error("❌ User not found!");
      return;
    }
    
    // Create the API key with the correct hash
    const newApiKey = await prisma.apiKey.create({
      data: {
        user_id: user.id,
        site_id: "c9b9f11e-7ab4-4c1d-a306-cce52ceb4657",
        name: "Culture hack test API Key",
        key_prefix: keyPrefix,
        key_hash: keyHash, // Using SHA256 hash, not bcrypt!
        scopes: ['search', 'embed'],
        is_active: true,
        rate_limit_per_hour: 1000
      }
    });
    
    console.log("✅ Created API key with correct SHA256 hash");
    console.log("   Prefix:", newApiKey.key_prefix);
    console.log("   Scopes:", newApiKey.scopes);
    
    // Verify it can be found
    const verification = await prisma.apiKey.findUnique({
      where: { key_hash: keyHash }
    });
    
    if (verification) {
      console.log("\n✅ Verification successful! API key is now properly stored.");
      
      // Get the license info
      const license = await prisma.license.findFirst({
        where: {
          user_id: user.id,
          status: "active"
        }
      });
      
      console.log("\n========================================");
      console.log("✅ WORDPRESS PLUGIN CONFIGURATION");
      console.log("========================================");
      console.log("License Key:  ", license?.license_key || "N/A");
      console.log("API Key:      ", apiKeyFromFrontend);
      console.log("Site ID:      ", "c9b9f11e-7ab4-4c1d-a306-cce52ceb4657");
      console.log("API Base URL: ", "https://api.lighthousestudios.xyz");
      console.log("========================================");
      console.log("\n✅ The API key from your frontend is now properly configured!");
      console.log("Try the test connection again in WordPress.");
    } else {
      console.error("❌ Verification failed!");
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixApiKey();