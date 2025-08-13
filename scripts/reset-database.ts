import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Load products from the single source of truth config file
const loadProductConfig = () => {
  const configPath = path.join(__dirname, '../src/config/products.config.json');
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    console.log(`✅ Loaded product config version ${config.version}`);
    return config;
  } catch (error) {
    console.error('❌ Failed to load products config:', error);
    throw new Error('Failed to load product configuration. Please ensure products.config.json exists.');
  }
};

async function resetDatabase() {
  console.log('🗑️  Starting database reset...');
  
  try {
    // Clear all tables in reverse order of dependencies
    console.log('Clearing existing data...');
    
    await prisma.queryUsage.deleteMany();
    await prisma.download.deleteMany();
    await prisma.pricingTier.deleteMany();
    await prisma.license.deleteMany();
    await prisma.activityLog.deleteMany();
    await prisma.siteProduct.deleteMany();
    await prisma.productEmbedding.deleteMany();
    await prisma.postChunk.deleteMany();
    await prisma.embeddingJob.deleteMany();
    await prisma.systemMetric.deleteMany();
    await prisma.billingEvent.deleteMany();
    await prisma.usageRecord.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.site.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    
    console.log('✅ All data cleared');
    
    // Load products from config file
    const config = loadProductConfig();
    const productsData = config.products;
    const pricingTiers = config.pricingTiers;
    
    // Create initial products from config
    console.log('Creating initial products from config...');
    
    const products = await Promise.all(
      productsData.map((product: any) => 
        prisma.product.create({
          data: {
            name: product.name,
            slug: product.slug,
            description: product.description,
            category: product.category,
            version: product.version,
            is_active: product.is_active,
            is_beta: product.is_beta,
            base_price: product.base_price,
            usage_based: product.usage_based,
            features: product.features,
            limits: product.limits,
            extended_documentation: product.extended_documentation
          }
        })
      )
    );
    
    console.log(`✅ Created ${products.length} initial products`);
    
    // Create pricing tiers from config
    console.log('Creating pricing tiers from config...');
    
    for (const product of products) {
      const productTiers = pricingTiers.filter((tier: any) => tier.product_slug === product.slug);
      
      // Create each tier from config
      for (const tierData of productTiers) {
        await prisma.pricingTier.create({
          data: {
            product_id: product.id,
            tier_name: tierData.tier_name,
            display_name: tierData.display_name,
            description: tierData.description,
            monthly_price: tierData.monthly_price,
            annual_price: tierData.annual_price,
            max_queries: tierData.max_queries,
            max_sites: tierData.max_sites,
            agent_api_access: tierData.agent_api_access,
            extra_site_price: tierData.extra_site_price,
            overage_price: tierData.overage_price,
            custom_embedding_markup: tierData.custom_embedding_markup,
            features: tierData.features,
            is_active: tierData.is_active,
            sort_order: tierData.sort_order
          }
        });
      }
    }
    
    console.log('✅ Created pricing tiers for all products');
    
    // Create a demo user with sample data (optional)
    console.log('Creating demo user...');
    
    const demoUser = await prisma.user.create({
      data: {
        email: 'demo@example.com',
        name: 'Demo User',
        password_hash: await bcrypt.hash('demo123456', 10),
        subscription_tier: 'pro',
        is_active: true
      }
    });
    
    // Create a demo site
    const demoSite = await prisma.site.create({
      data: {
        user_id: demoUser.id,
        name: 'Demo WordPress Site',
        url: 'https://demo.wordpress.local',
        description: 'A demo site for testing neural search functionality',
        embedding_status: 'completed',
        post_count: 100,
        chunk_count: 500
      }
    });
    
    // Create a demo API key
    const apiKeyValue = 'demo_' + Math.random().toString(36).substring(2, 15);
    await prisma.apiKey.create({
      data: {
        user_id: demoUser.id,
        site_id: demoSite.id,
        name: 'Demo API Key',
        key_prefix: apiKeyValue.substring(0, 8),
        key_hash: await bcrypt.hash(apiKeyValue, 10),
        scopes: ['search', 'embed'],
        rate_limit_per_hour: 1000
      }
    });
    
    // Create demo licenses for the user
    for (const product of products.slice(0, 2)) { // Give licenses for first 2 products
      await prisma.license.create({
        data: {
          user_id: demoUser.id,
          product_id: product.id,
          license_key: `DEMO-${product.slug.toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          license_type: 'standard',
          status: 'active',
          billing_period: 'monthly',
          amount_paid: product.base_price || 0,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          agent_api_access: false,
          max_sites: 1,
          max_queries: 1000,
          query_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
    }
    
    console.log('✅ Created demo user with sample data');
    console.log('   Email: demo@example.com');
    console.log('   Password: demo123456');
    console.log(`   API Key Prefix: ${apiKeyValue.substring(0, 8)}`);
    
    console.log('\n🎉 Database reset complete!');
    console.log(`   - ${products.length} products created`);
    console.log('   - Pricing tiers configured');
    console.log('   - Demo user with licenses created');
    
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the reset
resetDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });