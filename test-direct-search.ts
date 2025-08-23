import { PrismaClient } from '@prisma/client';
import { queryProductSearch } from './src/services/productVectorStore';

const prisma = new PrismaClient();
const SITE_ID = '1d667bd4-3b13-4182-8cfe-5a1adae683d9';

async function testDirectSearch() {
  console.log('🔍 Testing Direct Product Search');
  console.log('================================\n');

  const testQueries = [
    'protein',
    'vanilla',
    'chocolate',
    'plant based',
    'kick ass'
  ];

  for (const query of testQueries) {
    console.log(`\nSearching for: "${query}"`);
    console.log('-------------------');
    
    try {
      // Test the productVectorStore function directly
      const results = await queryProductSearch(SITE_ID, query, {}, 5);
      
      if (results && results.length > 0) {
        console.log(`✅ Found ${results.length} products:`);
        results.forEach((product, idx) => {
          console.log(`   ${idx + 1}. ${product.title}`);
          console.log(`      Score: ${((product as any).similarity_score * 100).toFixed(1)}%`);
        });
      } else {
        console.log('⚠️  No results found');
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
      
      // If THRESHOLD error, try with manual query
      if (error.message.includes('THRESHOLD')) {
        console.log('\n   Trying manual query with default threshold...');
        
        try {
          // Manual query to bypass THRESHOLD check
          const manualResults = await prisma.$queryRaw`
            SELECT 
              pe.id,
              pe.product_id,
              pe.title,
              pe.url,
              pe.price_usd,
              pe.category,
              pe.brand,
              1 - (pe.embedding <=> (
                SELECT embedding FROM product_embeddings 
                WHERE site_id = ${SITE_ID} 
                LIMIT 1
              )) as similarity_score
            FROM product_embeddings pe
            WHERE pe.site_id = ${SITE_ID}
            AND pe.title ILIKE ${'%' + query + '%'}
            ORDER BY similarity_score DESC
            LIMIT 5
          ` as any[];
          
          if (manualResults.length > 0) {
            console.log(`✅ Manual search found ${manualResults.length} products:`);
            manualResults.forEach((product: any, idx) => {
              console.log(`   ${idx + 1}. ${product.title}`);
            });
          }
        } catch (manualError) {
          console.log('   Manual query also failed:', manualError);
        }
      }
    }
  }

  await prisma.$disconnect();
}

testDirectSearch().catch(console.error);