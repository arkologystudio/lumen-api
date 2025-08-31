const { PrismaClient } = require('@prisma/client');

async function debugSearch() {
  const prisma = new PrismaClient();
  
  try {
    // Check total PostChunk count
    const totalChunks = await prisma.postChunk.count();
    console.log(`Total PostChunk records: ${totalChunks}`);
    
    // Check if we have any content for any sites
    if (totalChunks > 0) {
      const sampleChunks = await prisma.postChunk.findMany({
        take: 3,
        select: {
          site_id: true,
          post_title: true,
          content: true
        }
      });
      
      console.log('Sample chunks:');
      sampleChunks.forEach((chunk, i) => {
        console.log(`${i + 1}. Site: ${chunk.site_id}, Title: ${chunk.post_title}`);
        console.log(`   Content preview: ${chunk.content.substring(0, 100)}...`);
      });
      
      // Get unique site_ids
      const uniqueSites = await prisma.postChunk.groupBy({
        by: ['site_id'],
        _count: { site_id: true }
      });
      
      console.log('\nSites with content:');
      uniqueSites.forEach(site => {
        console.log(`Site ${site.site_id}: ${site._count.site_id} chunks`);
      });
    } else {
      console.log('No PostChunk records found. The database might be empty or content hasn\'t been embedded yet.');
    }
    
  } catch (error) {
    console.error('Database connection error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugSearch();