import { prisma } from "./src/config/database";
import crypto from "crypto";

async function testApiKey() {
  const apiKeyFromFrontend = "619370e277a3044eab05bc9e6bd75fa08405938b6a3ff50c7dc774fcefd47d4e";
  
  // Hash it using SHA256 (as the API does)
  const keyHash = crypto.createHash('sha256').update(apiKeyFromFrontend).digest('hex');
  
  console.log("API Key from frontend:", apiKeyFromFrontend);
  console.log("SHA256 Hash:", keyHash);
  console.log("\nChecking database for this hash...");
  
  // Check if this hash exists in the database
  const apiKey = await prisma.apiKey.findUnique({
    where: { key_hash: keyHash },
    include: { 
      user: true,
      site: true 
    }
  });
  
  if (apiKey) {
    console.log("\n✅ API Key found in database!");
    console.log("- Key Prefix:", apiKey.key_prefix);
    console.log("- Site:", apiKey.site?.name, "(ID:", apiKey.site_id, ")");
    console.log("- User:", apiKey.user.email);
    console.log("- Scopes:", apiKey.scopes);
    console.log("- Active:", apiKey.is_active);
  } else {
    console.log("\n❌ API Key NOT found in database with SHA256 hash!");
    
    // Let's check what API keys exist
    const allKeys = await prisma.apiKey.findMany({
      select: {
        key_prefix: true,
        key_hash: true,
        site_id: true,
        scopes: true,
        is_active: true
      }
    });
    
    console.log("\nExisting API keys in database:");
    allKeys.forEach(k => {
      console.log("- Prefix:", k.key_prefix, "| Hash starts with:", k.key_hash.substring(0, 20) + "...");
    });
    
    // Try to find by prefix
    const keyByPrefix = await prisma.apiKey.findFirst({
      where: { 
        key_prefix: apiKeyFromFrontend.substring(0, 8)
      }
    });
    
    if (keyByPrefix) {
      console.log("\n🔍 Found API key by prefix:", keyByPrefix.key_prefix);
      console.log("This key's hash:", keyByPrefix.key_hash);
      console.log("But it doesn't match the SHA256 hash of the provided key!");
    }
  }
  
  await prisma.$disconnect();
}

testApiKey();