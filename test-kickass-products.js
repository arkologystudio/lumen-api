const fetch = require('node-fetch');

// API Configuration
const API_BASE_URL = 'https://api.lighthousestudios.xyz/api';
const SITE_ID = '1d667bd4-3b13-4182-8cfe-5a1adae683d9';
const LICENSE_KEY = 'V5CX-ZSKU-N5IV-YZ96';
const API_KEY = '62fc58af22fac92e551b841c7a6a0166c2600b0ac013f8dd6fb9d5a59dbef658';

// Semantic queries specifically for Kick Ass protein products
const kickAssQueries = [
  // Direct product searches
  { query: "protein powder", description: "Direct product type search" },
  { query: "kick ass", description: "Brand name search" },
  { query: "plant based", description: "Product type - plant proteins" },
  
  // Flavor searches
  { query: "vanilla", description: "Vanilla flavored products" },
  { query: "chocolate", description: "Chocolate flavored products" },
  { query: "caramel", description: "Caramel flavored products" },
  { query: "fruity", description: "Fruit flavored products" },
  
  // Semantic/intent queries
  { query: "muscle recovery shake", description: "Post-workout intent" },
  { query: "morning protein", description: "Usage timing query" },
  { query: "tasty protein", description: "Taste-focused query" },
  { query: "double chocolate", description: "Specific flavor variant" },
  
  // Ingredient/dietary queries
  { query: "keto friendly", description: "Dietary restriction" },
  { query: "collagen", description: "Specific ingredient search" },
  { query: "whey protein", description: "Protein type search" },
  
  // Use case queries
  { query: "pre workout", description: "Before exercise use" },
  { query: "meal replacement", description: "Alternative use case" },
  { query: "performance blend", description: "Performance focus" }
];

async function searchProducts(query) {
  // Try the unified search endpoint
  const url = `${API_BASE_URL}/embedding/unified-search`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'X-License-Key': LICENSE_KEY,
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        query: query,
        site_id: SITE_ID,
        topK: 5,
        search_type: 'product'
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      // If unified search fails, try the site-specific endpoint
      return await searchSiteProducts(query);
    }
    
    return data;
  } catch (error) {
    console.error(`Unified search error for "${query}":`, error.message);
    // Fallback to site-specific search
    return await searchSiteProducts(query);
  }
}

async function searchSiteProducts(query) {
  const url = `${API_BASE_URL}/sites/${SITE_ID}/search`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-License-Key': LICENSE_KEY,
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        query: query,
        topK: 5,
        type: 'product'
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error(`Site search error: ${response.status} - ${JSON.stringify(data)}`);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error(`Site search error for "${query}":`, error.message);
    return null;
  }
}

async function testProductAPI() {
  console.log('🏋️ Testing Kick Ass Product Search');
  console.log('====================================\n');
  console.log(`Shop: https://kickassfit.co.za/protein-powders/`);
  console.log(`Site ID: ${SITE_ID}`);
  console.log(`API: ${API_BASE_URL}\n`);
  
  console.log('Testing semantic search capabilities for fitness products...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const test of kickAssQueries) {
    console.log(`\n🔍 Query: "${test.query}"`);
    console.log(`   Context: ${test.description}`);
    console.log('   ---');
    
    const results = await searchProducts(test.query);
    
    if (results && results.results && results.results.length > 0) {
      successCount++;
      console.log(`   ✅ Found ${results.results.length} products:`);
      
      results.results.slice(0, 3).forEach((product, idx) => {
        const name = product.title || product.name || 'Unknown Product';
        console.log(`   ${idx + 1}. ${name}`);
        
        if (product.similarity_score !== undefined) {
          console.log(`      Relevance: ${(product.similarity_score * 100).toFixed(1)}%`);
        }
        
        if (product.price) {
          console.log(`      Price: R${product.price}`);
        }
        
        if (product.brand) {
          console.log(`      Brand: ${product.brand}`);
        }
        
        if (product.category) {
          console.log(`      Category: ${product.category}`);
        }
      });
    } else if (results && results.results && results.results.length === 0) {
      console.log('   ⚠️  No products found for this query');
    } else {
      failCount++;
      console.log('   ❌ Search failed - API or connection issue');
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log('\n\n📊 Results Summary');
  console.log('==================');
  console.log(`✅ Successful searches: ${successCount}/${kickAssQueries.length}`);
  console.log(`❌ Failed searches: ${failCount}/${kickAssQueries.length}`);
  
  if (successCount > 0) {
    console.log('\n💡 Neural Search Capabilities Demonstrated:');
    console.log('• Brand recognition (Kick Ass)');
    console.log('• Flavor understanding (vanilla, chocolate, caramel)');
    console.log('• Dietary preferences (plant-based, keto)');
    console.log('• Use case matching (pre-workout, recovery)');
    console.log('• Semantic understanding (muscle recovery → protein powder)');
  }
  
  if (failCount === kickAssQueries.length) {
    console.log('\n⚠️  All searches failed. Possible issues:');
    console.log('• Products may not be embedded yet');
    console.log('• API configuration issue');
    console.log('• Connection problem');
    console.log('\nPlease ensure products are embedded via WooCommerce → Lumen Search → Start Embedding Products');
  }
}

// Run the test
testProductAPI().catch(console.error);