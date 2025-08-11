import { prisma } from "./src/config/database";

async function debugLicense() {
  try {
    // Check all licenses
    const licenses = await prisma.license.findMany({
      include: {
        product: true,
        user: true
      }
    });
    
    console.log("📋 All licenses in database:", licenses.length);
    licenses.forEach(l => {
      console.log("\nLicense:", {
        key: l.license_key,
        product: l.product?.slug,
        status: l.status,
        is_active: l.is_active,
        expires_at: l.expires_at,
        user: l.user?.email
      });
    });
    
    // Check all users
    const users = await prisma.user.findMany();
    console.log("\n👥 All users:", users.length);
    users.forEach(u => {
      console.log("- User:", u.email, "(ID:", u.id, ")");
    });
    
    // Check all sites with their API keys
    const sites = await prisma.site.findMany({
      include: {
        api_keys: true
      }
    });
    console.log("\n🌐 All sites:", sites.length);
    sites.forEach(s => {
      console.log("- Site:", s.name, "| URL:", s.url, "| ID:", s.id);
      if (s.api_keys.length > 0) {
        s.api_keys.forEach(key => {
          console.log("  - API Key Prefix:", key.key_prefix, "| Scopes:", key.scopes, "| Active:", key.is_active);
          console.log("    Key Hash:", key.key_hash.substring(0, 20) + "...");
        });
      } else {
        console.log("  - No API keys");
      }
    });
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

debugLicense();