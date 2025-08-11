import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
    
    // Create initial products
    console.log('Creating initial products...');
    
    const products = await Promise.all([
      prisma.product.create({
        data: {
          name: 'AI Ready Core',
          slug: 'ai-ready-core',
          description: 'Core neural search functionality for WordPress sites',
          category: 'search',
          version: '1.0.0',
          is_active: true,
          is_beta: false,
          base_price: 29,
          usage_based: true,
          features: {
            core: [
              'Neural search powered by AI',
              'Smart text chunking',
              'Vector embeddings',
              'Semantic similarity search',
              'WordPress integration'
            ]
          },
          limits: {
            standard: { queries: 1000, sites: 1 },
            standard_plus: { queries: 2500, sites: 3 },
            premium: { queries: 5000, sites: 5 },
            premium_plus: { queries: 10000, sites: 10 },
            enterprise: { queries: null, sites: null }
          },
          filename: 'ai-ready-core.zip',
          file_path: 'products/ai-ready-core/ai-ready-core-v1.0.0.zip',
          file_size: 2458624, // ~2.4 MB
          file_hash: 'sha256:abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yz567890',
          content_type: 'application/zip',
          is_public: false,
          max_downloads: null,
          release_notes: 'Initial release of AI Ready Core with full neural search capabilities',
          changelog: '## Version 1.0.0\n- Initial release\n- Neural search implementation\n- WordPress REST API integration\n- Smart chunking algorithm'
        }
      }),
      
      prisma.product.create({
        data: {
          name: 'WooCommerce AI Search',
          slug: 'woocommerce-ai-search',
          description: 'AI-powered product search for WooCommerce stores',
          category: 'ecommerce',
          version: '1.0.0',
          is_active: true,
          is_beta: false,
          base_price: 49,
          usage_based: true,
          features: {
            core: [
              'Product embedding generation',
              'Semantic product search',
              'Brand and category filtering',
              'Price-aware search results',
              'Inventory status integration'
            ]
          },
          limits: {
            standard: { queries: 2000, sites: 1 },
            standard_plus: { queries: 5000, sites: 3 },
            premium: { queries: 10000, sites: 5 },
            premium_plus: { queries: 25000, sites: 10 },
            enterprise: { queries: null, sites: null }
          },
          filename: 'woocommerce-ai-search.zip',
          file_path: 'products/woocommerce/woocommerce-ai-search-v1.0.0.zip',
          file_size: 3145728, // ~3 MB
          file_hash: 'sha256:wxyz1234abcd5678efgh9012ijkl3456mnop7890qrst1234uvwx5678',
          content_type: 'application/zip',
          is_public: false,
          max_downloads: null,
          release_notes: 'First release of WooCommerce AI Search with advanced product discovery',
          changelog: '## Version 1.0.0\n- WooCommerce integration\n- Product embedding pipeline\n- Advanced filtering options\n- Real-time inventory sync'
        }
      }),
      
      prisma.product.create({
        data: {
          name: 'Content Intelligence Suite',
          slug: 'content-intelligence',
          description: 'Advanced content analysis and insights powered by AI',
          category: 'analysis',
          version: '1.0.0',
          is_active: true,
          is_beta: true,
          base_price: 79,
          usage_based: true,
          features: {
            core: [
              'Content quality scoring',
              'SEO optimization suggestions',
              'Readability analysis',
              'Topic clustering',
              'Content gap analysis',
              'Competitor content tracking'
            ]
          },
          limits: {
            standard: { analyses: 100, sites: 1 },
            standard_plus: { analyses: 250, sites: 2 },
            premium: { analyses: 500, sites: 5 },
            premium_plus: { analyses: 1000, sites: 10 },
            enterprise: { analyses: null, sites: null }
          },
          filename: 'content-intelligence-suite.zip',
          file_path: 'products/intelligence/content-intelligence-v1.0.0-beta.zip',
          file_size: 4194304, // ~4 MB
          file_hash: 'sha256:mnop1234qrst5678uvwx9012yzab3456cdef7890ghij1234klmn5678',
          content_type: 'application/zip',
          is_public: false,
          max_downloads: null,
          release_notes: 'Beta release of Content Intelligence Suite',
          changelog: '## Version 1.0.0-beta\n- Content quality algorithms\n- SEO analysis engine\n- Topic clustering implementation\n- Beta testing features'
        }
      }),
      
      prisma.product.create({
        data: {
          name: 'API Gateway Pro',
          slug: 'api-gateway-pro',
          description: 'Enterprise API management and orchestration platform',
          category: 'infrastructure',
          version: '2.0.0',
          is_active: true,
          is_beta: false,
          base_price: 199,
          usage_based: true,
          features: {
            core: [
              'Rate limiting and throttling',
              'API key management',
              'Request/response transformation',
              'Multi-site orchestration',
              'Advanced caching',
              'Real-time analytics dashboard'
            ],
            enterprise: [
              'Custom middleware',
              'Load balancing',
              'Failover configuration',
              'Advanced security rules'
            ]
          },
          limits: {
            standard: { requests: 100000, sites: 5 },
            standard_plus: { requests: 500000, sites: 10 },
            premium: { requests: 2000000, sites: 25 },
            premium_plus: { requests: 5000000, sites: 50 },
            enterprise: { requests: null, sites: null }
          },
          filename: 'api-gateway-pro.zip',
          file_path: 'products/gateway/api-gateway-pro-v2.0.0.zip',
          file_size: 6291456, // ~6 MB
          file_hash: 'sha256:ijkl1234mnop5678qrst9012uvwx3456yzab7890cdef1234ghij5678',
          content_type: 'application/zip',
          is_public: false,
          max_downloads: null,
          release_notes: 'Major release with enterprise features',
          changelog: '## Version 2.0.0\n- Complete architecture overhaul\n- Enterprise features added\n- Performance improvements\n- New analytics dashboard'
        }
      })
    ]);
    
    console.log(`✅ Created ${products.length} initial products`);
    
    // Create pricing tiers for each product
    console.log('Creating pricing tiers...');
    
    for (const product of products) {
      const basePrices = {
        'ai-ready-core': { standard: 29, standard_plus: 49, premium: 99, premium_plus: 199, enterprise: 499 },
        'woocommerce-ai-search': { standard: 49, standard_plus: 79, premium: 149, premium_plus: 299, enterprise: 699 },
        'content-intelligence': { standard: 79, standard_plus: 119, premium: 199, premium_plus: 399, enterprise: 999 },
        'api-gateway-pro': { standard: 199, standard_plus: 349, premium: 599, premium_plus: 999, enterprise: 2499 }
      };
      
      const prices = basePrices[product.slug as keyof typeof basePrices];
      
      const tiers = [
        {
          tier_name: 'standard',
          display_name: 'Standard',
          description: 'Perfect for small sites and blogs',
          monthly_price: prices.standard,
          annual_price: prices.standard * 10, // 2 months free
          max_queries: product.slug === 'api-gateway-pro' ? 100000 : 1000,
          max_sites: 1,
          agent_api_access: false,
          extra_site_price: 19,
          overage_price: 0.05,
          sort_order: 1
        },
        {
          tier_name: 'standard_plus',
          display_name: 'Standard+',
          description: 'Great for growing sites with moderate traffic',
          monthly_price: prices.standard_plus,
          annual_price: prices.standard_plus * 10,
          max_queries: product.slug === 'api-gateway-pro' ? 500000 : 2500,
          max_sites: 3,
          agent_api_access: false,
          extra_site_price: 15,
          overage_price: 0.04,
          sort_order: 2
        },
        {
          tier_name: 'premium',
          display_name: 'Premium',
          description: 'Ideal for professional sites and agencies',
          monthly_price: prices.premium,
          annual_price: prices.premium * 10,
          max_queries: product.slug === 'api-gateway-pro' ? 2000000 : 5000,
          max_sites: 5,
          agent_api_access: true,
          extra_site_price: 12,
          overage_price: 0.03,
          sort_order: 3
        },
        {
          tier_name: 'premium_plus',
          display_name: 'Premium+',
          description: 'Advanced features for high-traffic sites',
          monthly_price: prices.premium_plus,
          annual_price: prices.premium_plus * 10,
          max_queries: product.slug === 'api-gateway-pro' ? 5000000 : 10000,
          max_sites: 10,
          agent_api_access: true,
          extra_site_price: 10,
          overage_price: 0.02,
          sort_order: 4
        },
        {
          tier_name: 'enterprise',
          display_name: 'Enterprise',
          description: 'Unlimited usage with dedicated support',
          monthly_price: prices.enterprise,
          annual_price: prices.enterprise * 10,
          max_queries: null, // unlimited
          max_sites: 100,
          agent_api_access: true,
          extra_site_price: 8,
          overage_price: 0,
          custom_embedding_markup: 25,
          sort_order: 5
        }
      ];
      
      await prisma.pricingTier.createMany({
        data: tiers.map(tier => ({
          ...tier,
          product_id: product.id
        }))
      });
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