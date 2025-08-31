const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
require('dotenv').config();

async function embedText(text) {
  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${process.env.EMBEDDING_MODEL}`,
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGING_FACE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const data = response.data;
    const embeddingVector = Array.isArray(data[0]) ? data[0] : data;
    return embeddingVector;
  } catch (error) {
    console.error('Error embedding text:', error.message);
    return null;
  }
}

async function testRealSearch() {
  const prisma = new PrismaClient();
  const siteId = 'c9b9f11e-7ab4-4c1d-a306-cce52ceb4657';
  const query = 'What is a listening model?';
  
  console.log('Testing real search with actual embeddings...');
  console.log('Query:', query);
  console.log('Site ID:', siteId);
  console.log('Current threshold:', process.env.THRESHOLD);
  
  try {
    // Embed the query
    console.log('\n1. Embedding query...');
    const queryEmbedding = await embedText(query);
    
    if (!queryEmbedding) {
      console.error('Failed to embed query');
      return;
    }
    
    console.log(`✓ Query embedded successfully (dimension: ${queryEmbedding.length})`);
    
    // Format embedding for SQL
    const queryEmbeddingStr = `[${queryEmbedding.join(',')}]`;
    
    // Test with different thresholds
    const thresholds = [0.9, 0.81, 0.7, 0.6, 0.5, 0.3];
    
    for (const threshold of thresholds) {
      console.log(`\n2. Searching with threshold ${threshold}...`);
      
      try {
        const searchResults = await prisma.$queryRaw`
          SELECT 
            post_title,
            content,
            (1 - (embedding <=> ${queryEmbeddingStr}::vector)) as similarity
          FROM post_chunks 
          WHERE site_id = ${siteId}
            AND embedding IS NOT NULL
            AND (1 - (embedding <=> ${queryEmbeddingStr}::vector)) >= ${threshold}
          ORDER BY embedding <=> ${queryEmbeddingStr}::vector
          LIMIT 5
        `;
        
        console.log(`   Found ${searchResults.length} results`);
        
        if (searchResults.length > 0) {
          searchResults.forEach((result, i) => {
            console.log(`   ${i + 1}. "${result.post_title}"`);
            console.log(`      Similarity: ${result.similarity?.toFixed(4)}`);
            console.log(`      Content: ${result.content.substring(0, 150)}...`);
          });
          
          // If we found results with this threshold, we can stop
          if (threshold >= parseFloat(process.env.THRESHOLD)) {
            console.log(`\n✓ Results found with current threshold (${process.env.THRESHOLD})`);
            break;
          }
        } else if (threshold === 0.3) {
          console.log('   No results even with very low threshold - checking for issues...');
          
          // Check if any embeddings exist at all
          const anyResults = await prisma.$queryRaw`
            SELECT 
              post_title,
              content,
              (1 - (embedding <=> ${queryEmbeddingStr}::vector)) as similarity
            FROM post_chunks 
            WHERE site_id = ${siteId}
              AND embedding IS NOT NULL
            ORDER BY embedding <=> ${queryEmbeddingStr}::vector
            LIMIT 3
          `;
          
          if (anyResults.length > 0) {
            console.log('   Top matches (no threshold):');
            anyResults.forEach((result, i) => {
              console.log(`   ${i + 1}. "${result.post_title}" (similarity: ${result.similarity?.toFixed(4)})`);
            });
          }
        }
      } catch (error) {
        console.error(`   Error with threshold ${threshold}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRealSearch();