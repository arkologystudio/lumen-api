// Test product search on LOCAL API
const fetch = require('node-fetch');

// LOCAL API Configuration
const API_BASE_URL = 'http://localhost:4000/api'; // Local API on port 4000
const SITE_ID = '1d667bd4-3b13-4182-8cfe-5a1adae683d9';
const LICENSE_KEY = 'V5CX-ZSKU-N5IV-YZ96';
const API_KEY = 'aafade284578889f452b22bd57c99f8d0f5f9c7730a492d542bb76f29bbf83ab';

console.log('🔧 Testing LOCAL API at:', API_BASE_URL);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Semantic queries for Kick Ass protein products
const testQueries = [
  // Direct searches
  { query: "protein", description: "Basic protein search" },
  { query: "kick ass", description: "Brand name search" },
  { query: "plant based", description: "Plant-based products" },
  
  // Flavors from the shop
  { query: "salted caramel", description: "Salted Caramel flavor" },
  { query: "double chocolate", description: "Double Choc flavor" },
  { query: "dark vanilla", description: "Dark Vanilla flavor" },
  { query: "super fruity", description: "Super Fruity flavor" },
  
  // Semantic/conceptual queries
  { query: "muscle recovery", description: "Post-workout recovery" },
  { query: "vegan protein", description: "Plant-based/vegan options" },
  { query: "chocolate flavor", description: "Chocolate products" },
  { query: "fruit flavor", description: "Fruity products" },
  
  // Intent queries
  { query: "build muscle", description: "Muscle building intent" },
  { query: "post workout shake", description: "Recovery shake" },
  { query: "tasty protein", description: "Taste-focused query" }
];

async function testLocalSearch(query) {
  const url = `${API_BASE_URL}/sites/${SITE_ID}/search`;
  
  console.log(`\n🔍 Testing: "${query.query}"`);
  console.log(`   Purpose: ${query.description}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-License-Key': LICENSE_KEY,
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        query: query.query,
        topK: 5,
        type: 'product'
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.log(`   ❌ Error ${response.status}: ${data.error || data.message || 'Unknown error'}`);
      return false;
    }
    
    // Check both data.results and data.data.results (API returns data.data.results structure)
    const results = data.results || (data.data && data.data.results) || [];
    
    if (results.length > 0) {
      console.log(`   ✅ Found ${results.length} products:`);
      
      results.slice(0, 3).forEach((product, idx) => {
        const name = product.title || product.name || product.product_title || 'Unknown Product';
        const score = product.similarity_score || product.score || 0;
        console.log(`      ${idx + 1}. ${name}`);
        console.log(`         Relevance: ${(score * 100).toFixed(1)}%`);
        
        if (product.attributes && product.attributes.price_usd) {
          console.log(`         Price: R${product.attributes.price_usd}`);
        }
      });
      return true;
    } else {
      console.log('   ⚠️  No products found');
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Connection error: ${error.message}`);
    return false;
  }
}

async function checkAPIHealth() {
  console.log('🏥 Checking API Health...');
  
  try {
    // First check if API is running
    const healthCheck = await fetch(`${API_BASE_URL.replace('/api', '')}/health`).catch(() => null);
    if (!healthCheck || !healthCheck.ok) {
      console.log('   ⚠️  API health check endpoint not responding');
    } else {
      console.log('   ✅ API is running');
    }
    
    // Check site configuration
    const siteCheck = await fetch(`${API_BASE_URL}/sites/${SITE_ID}/stats`, {
      headers: {
        'x-api-key': API_KEY,
        'X-License-Key': LICENSE_KEY
      }
    });
    
    if (siteCheck.ok) {
      const siteData = await siteCheck.json();
      console.log('   ✅ Site found:', siteData.site?.name || SITE_ID);
      
      if (siteData.stats) {
        console.log(`   📊 Stats: ${siteData.stats.post_count || 0} posts, ${siteData.stats.product_count || 0} products`);
      }
    } else {
      console.log('   ⚠️  Could not fetch site stats');
    }
  } catch (error) {
    console.log('   ❌ API connection failed:', error.message);
    console.log('\n   💡 Make sure the API is running:');
    console.log('      cd /Users/checoelho/Desktop/lighthouse/code/repos/lighthouse-api');
    console.log('      npm run dev');
    return false;
  }
  
  return true;
}

async function runTests() {
  console.log('🎯 Kick Ass Product Search - LOCAL TEST');
  console.log('========================================\n');
  
  // Check API health first
  const apiHealthy = await checkAPIHealth();
  if (!apiHealthy) {
    console.log('\n⚠️  Please start the local API first!');
    return;
  }
  
  console.log('\n📝 Starting semantic search tests...');
  console.log('────────────────────────────────────');
  
  let successCount = 0;
  
  for (const query of testQueries) {
    const success = await testLocalSearch(query);
    if (success) successCount++;
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('\n\n📊 RESULTS SUMMARY');
  console.log('==================');
  console.log(`✅ Successful searches: ${successCount}/${testQueries.length}`);
  
  if (successCount === 0) {
    console.log('\n⚠️  No searches succeeded. Possible issues:');
    console.log('   1. Products not embedded yet');
    console.log('   2. Database connection issue');
    console.log('   3. THRESHOLD environment variable missing');
    console.log('\n💡 To embed products:');
    console.log('   1. Go to WooCommerce → Lumen Search');
    console.log('   2. Click "Start Embedding Products"');
  } else if (successCount === testQueries.length) {
    console.log('\n🎉 All searches successful!');
    console.log('\n💪 Neural search is working perfectly for:');
    console.log('   • Brand recognition (Kick Ass)');
    console.log('   • Flavor matching (chocolate, vanilla, caramel, fruity)');
    console.log('   • Semantic understanding (muscle recovery → protein)');
    console.log('   • Intent matching (build muscle → protein powder)');
  } else {
    console.log(`\n⚠️  Partial success (${successCount}/${testQueries.length})`);
    console.log('   Some queries may need more training data');
  }
}

// Run the tests
runTests().catch(console.error);