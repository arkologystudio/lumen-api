const { PrismaClient } = require('@prisma/client');

async function testSearch() {
  const prisma = new PrismaClient();
  
  const siteId = 'c9b9f11e-7ab4-4c1d-a306-cce52ceb4657';
  const query = 'What is a listening model?';
  
  // Test with different thresholds
  const thresholds = [0.81, 0.7, 0.6, 0.5, 0.3];
  
  try {
    // First, let's see what happens with a very low threshold
    for (const threshold of thresholds) {
      console.log(`\n=== Testing with threshold: ${threshold} ===`);
      
      // Simulate embedding the query (we'll use a dummy embedding for testing)
      // In reality, this would come from the HuggingFace API
      const dummyEmbedding = '[0.1,0.2,0.3]'; // This is just for syntax testing
      
      try {
        const searchResults = await prisma.$queryRaw`
          SELECT 
            post_title,
            content,
            (1 - (embedding <=> ${dummyEmbedding}::vector)) as similarity
          FROM post_chunks 
          WHERE site_id = ${siteId}
            AND embedding IS NOT NULL
            AND (1 - (embedding <=> ${dummyEmbedding}::vector)) >= ${threshold}
          ORDER BY embedding <=> ${dummyEmbedding}::vector
          LIMIT 5
        `;
        
        console.log(`Found ${searchResults.length} results above threshold ${threshold}`);
        
        if (searchResults.length > 0) {
          searchResults.forEach((result, i) => {
            console.log(`${i + 1}. "${result.post_title}" (similarity: ${result.similarity?.toFixed(3)})`);
            console.log(`   Content: ${result.content.substring(0, 100)}...`);
          });
        }
      } catch (error) {
        if (error.message.includes('vector')) {
          console.log('Vector extension working, but dummy embedding failed (expected)');
          
          // Let's check how many records have embeddings
          const embedCount = await prisma.$queryRaw`
            SELECT COUNT(*) as count
            FROM post_chunks 
            WHERE site_id = ${siteId} AND embedding IS NOT NULL
          `;
          console.log(`Records with embeddings: ${embedCount[0].count}`);
        } else {
          console.error('Unexpected error:', error.message);
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

testSearch();