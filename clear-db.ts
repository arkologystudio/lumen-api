import { prisma } from "./src/config/database";

async function clearDatabase() {
  console.log("🗑️  Clearing database...\n");
  
  try {
    // Use transactions to ensure atomic operation
    await prisma.$transaction(async (tx) => {
      await tx.queryUsage.deleteMany({});
      await tx.license.deleteMany({});
      await tx.siteProduct.deleteMany({});
      await tx.activityLog.deleteMany({});
      await tx.productEmbedding.deleteMany({});
      await tx.postChunk.deleteMany({});
      await tx.site.deleteMany({});
      await tx.product.deleteMany({});
      await tx.user.deleteMany({});
    });
    
    console.log("✅ Database cleared successfully!");
    
    // Now reinitialize products
    console.log("\n📦 Initializing products...\n");
    
    await prisma.product.createMany({
      data: [
        {
          name: "AI Readiness Analysis",
          slug: "ai-readiness-analysis",
          description: "Comprehensive AI implementation assessment for WordPress sites",
          category: "analysis",
          version: "1.0.0",
          is_active: true,
          is_beta: false,
          base_price: 49.99,
          usage_based: false,
          features: ["Content quality analysis", "SEO optimization check", "Performance metrics", "AI implementation recommendations", "Custom reporting"],
          limits: { max_reports: 10, max_sites: 3 },
          is_public: true
        },
        {
          name: "Neural Search - Knowledge",
          slug: "neural-search-knowledge",
          description: "AI-powered semantic search for knowledge bases and documentation",
          category: "search",
          version: "2.0.0",
          is_active: true,
          is_beta: false,
          base_price: 29.99,
          usage_based: true,
          features: ["Semantic search", "Vector embeddings", "Real-time indexing", "Custom post type support", "Search analytics"],
          limits: { max_queries_monthly: 10000, max_documents: 50000, max_sites: 1 },
          is_public: true
        },
        {
          name: "Neural Search - Product",
          slug: "neural-search-product",
          description: "Advanced product search with AI understanding for WooCommerce",
          category: "search",
          version: "2.0.0",
          is_active: true,
          is_beta: false,
          base_price: 39.99,
          usage_based: true,
          features: ["Product semantic search", "Attribute understanding", "Visual similarity search", "Inventory-aware results", "Conversion optimization"],
          limits: { max_queries_monthly: 15000, max_products: 100000, max_sites: 1 },
          is_public: true
        }
      ]
    });
    
    console.log("✅ Products initialized!");
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();