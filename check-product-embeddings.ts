import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SITE_ID = '1d667bd4-3b13-4182-8cfe-5a1adae683d9';

async function checkProductEmbeddings() {
  console.log('🔍 Checking Product Embeddings in Database');
  console.log('=========================================\n');
  console.log(`Site ID: ${SITE_ID}\n`);

  try {
    // Check if site exists
    const site = await prisma.site.findUnique({
      where: { id: SITE_ID }
    });

    if (site) {
      console.log('✅ Site found:', site.name);
      console.log('   URL:', site.url);
      console.log('   Status:', site.embedding_status);
      console.log('   Post count:', site.post_count);
      console.log('   Chunk count:', site.chunk_count);
      console.log('');
    } else {
      console.log('❌ Site not found in database\n');
    }

    // Check for product embeddings
    console.log('📦 Checking ProductEmbedding table...');
    
    const productCount = await prisma.productEmbedding.count({
      where: { site_id: SITE_ID }
    });

    console.log(`   Total products for this site: ${productCount}`);

    if (productCount > 0) {
      // Get sample products
      const products = await prisma.productEmbedding.findMany({
        where: { site_id: SITE_ID },
        take: 10,
        select: {
          id: true,
          product_id: true,
          title: true,
          url: true,
          brand: true,
          category: true,
          price_usd: true,
          created_at: true,
          searchable_text: true
        }
      });

      console.log('\n📋 Sample products:');
      products.forEach((product, idx) => {
        console.log(`\n   ${idx + 1}. ${product.title}`);
        console.log(`      Product ID: ${product.product_id}`);
        console.log(`      Brand: ${product.brand || 'N/A'}`);
        console.log(`      Category: ${product.category || 'N/A'}`);
        console.log(`      Price: ${product.price_usd ? `$${product.price_usd}` : 'N/A'}`);
        console.log(`      URL: ${product.url}`);
        console.log(`      Embedded: ${product.created_at}`);
        if (product.searchable_text) {
          console.log(`      Text preview: ${product.searchable_text.substring(0, 100)}...`);
        }
      });

      // Check if embeddings have vectors
      const withVectors = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM product_embeddings 
        WHERE site_id = ${SITE_ID} 
        AND embedding IS NOT NULL
      ` as any[];

      console.log(`\n   Products with vector embeddings: ${withVectors[0]?.count || 0}`);
    }

    // Also check PostChunk table for comparison
    console.log('\n\n📄 Checking PostChunk table...');
    const postCount = await prisma.postChunk.count({
      where: { site_id: SITE_ID }
    });
    console.log(`   Total post chunks for this site: ${postCount}`);

    // Check all product embeddings across all sites
    console.log('\n\n🌍 Global product check:');
    const allProductCount = await prisma.productEmbedding.count();
    console.log(`   Total products in database (all sites): ${allProductCount}`);

    if (allProductCount > 0) {
      const sitesWithProducts = await prisma.productEmbedding.groupBy({
        by: ['site_id'],
        _count: {
          id: true
        }
      });

      console.log(`   Sites with products: ${sitesWithProducts.length}`);
      sitesWithProducts.forEach(site => {
        console.log(`      ${site.site_id}: ${site._count.id} products`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductEmbeddings();