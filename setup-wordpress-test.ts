import { prisma } from "./src/config/database";
import crypto from "crypto";
import bcrypt from "bcrypt";

async function setupWordPressTest() {
  try {
    console.log("🔧 Setting up WordPress test environment...\n");
    
    // The site ID from your WordPress plugin
    const WORDPRESS_SITE_ID = "c9b9f11e-7ab4-4c1d-a306-cce52ceb4657";
    
    // Check if we have the user with the license
    const user = await prisma.user.findUnique({
      where: { email: "che@che.com" }
    });
    
    if (!user) {
      console.error("❌ User che@che.com not found!");
      return;
    }
    
    // Update the existing site to use the WordPress site ID
    const existingSite = await prisma.site.findFirst({
      where: { user_id: user.id }
    });
    
    let site;
    if (existingSite) {
      // Update the existing site to use the correct ID
      await prisma.site.delete({ where: { id: existingSite.id } });
      site = await prisma.site.create({
        data: {
          id: WORDPRESS_SITE_ID,
          user_id: user.id,
          name: existingSite.name,
          url: existingSite.url,
          description: existingSite.description,
          is_active: true
        }
      });
      console.log("✅ Updated site to use WordPress site ID:", WORDPRESS_SITE_ID);
    } else {
      // Create new site with the WordPress ID
      site = await prisma.site.create({
        data: {
          id: WORDPRESS_SITE_ID,
          user_id: user.id,
          name: "Culture Hack",
          url: "http://culturehack.test",
          description: "WordPress test site",
          is_active: true
        }
      });
      console.log("✅ Created site with WordPress site ID:", WORDPRESS_SITE_ID);
    }
    
    // Delete existing API keys for this site
    await prisma.apiKey.deleteMany({
      where: { site_id: WORDPRESS_SITE_ID }
    });
    
    // Generate a new API key
    const apiKeyRaw = `sk_${crypto.randomBytes(32).toString('base64url')}`;
    const apiKeyPrefix = apiKeyRaw.substring(0, 8);
    const apiKeyHash = await bcrypt.hash(apiKeyRaw, 10);
    
    await prisma.apiKey.create({
      data: {
        user_id: user.id,
        site_id: WORDPRESS_SITE_ID,
        name: "WordPress Plugin Key",
        key_prefix: apiKeyPrefix,
        key_hash: apiKeyHash,
        scopes: ['search', 'embed'],
        is_active: true
      }
    });
    
    console.log("✅ Created new API key");
    
    // Get the license
    const license = await prisma.license.findFirst({
      where: {
        user_id: user.id,
        status: "active"
      },
      include: {
        product: true
      }
    });
    
    if (!license) {
      console.error("❌ No active license found for user!");
      return;
    }
    
    console.log("\n========================================");
    console.log("🎯 WORDPRESS PLUGIN CONFIGURATION");
    console.log("========================================");
    console.log("License Key:  ", license.license_key);
    console.log("API Key:      ", apiKeyRaw);  // This is the FULL key!
    console.log("Site ID:      ", WORDPRESS_SITE_ID);
    console.log("API Base URL: ", "https://api.lighthousestudios.xyz");
    console.log("========================================");
    console.log("\n⚠️  IMPORTANT: Save the API key above! It won't be shown again.");
    console.log("Enter these values in your WordPress plugin settings.\n");
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

setupWordPressTest();