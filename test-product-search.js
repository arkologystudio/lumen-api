const fetch = require('node-fetch');

// API Configuration
const API_BASE_URL = 'https://api.lighthousestudios.xyz/api';
const SITE_ID = '1d667bd4-3b13-4182-8cfe-5a1adae683d9';
const LICENSE_KEY = 'V5CX-ZSKU-N5IV-YZ96';
const API_KEY = '62fc58af22fac92e551b841c7a6a0166c2600b0ac013f8dd6fb9d5a59dbef658';

// Semantic queries that showcase neural search power
const semanticQueries = [
  // Conceptual understanding
  { query: "muscle building", description: "Should find protein products even without exact match" },
  { query: "post workout recovery", description: "Semantic understanding of fitness recovery needs" },
  { query: "energy boost", description: "Should find pre-workout or energy-related products" },
  
  // Intent-based queries
  { query: "something for gains", description: "Colloquial fitness term for muscle growth" },
  { query: "bulk up", description: "Intent to gain muscle mass" },
  { query: "lean muscle", description: "Specific fitness goal" },
  
  // Attribute-based semantic search
  { query: "chocolate flavor", description: "Flavor preference search" },
  { query: "vegan protein", description: "Dietary restriction search" },
  { query: "low calorie", description: "Nutritional preference" },
  
  // Question-style queries
  { query: "what helps with muscle soreness", description: "Natural language question" },
  { query: "best for morning workout", description: "Time-specific use case" },
  
  // Misspellings and variations
  { query: "protien powder", description: "Common misspelling handling" },
  { query: "whey vs plant", description: "Comparison query" }
];

async function searchProducts(query) {
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
        search_type: 'product'
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error searching for "${query}":`, error.message);
    return null;
  }
}

async function runSemanticTests() {
  console.log('🧪 Testing Neural Search for Products');
  console.log('=====================================\n');
  console.log(`Site ID: ${SITE_ID}`);
  console.log(`API Endpoint: ${API_BASE_URL}\n`);
  console.log('Starting semantic query tests...\n');
  
  for (const test of semanticQueries) {
    console.log(`\n📍 Query: "${test.query}"`);
    console.log(`   Purpose: ${test.description}`);
    console.log('   ---');
    
    const results = await searchProducts(test.query);
    
    if (results && results.results) {
      if (results.results.length > 0) {
        console.log(`   ✅ Found ${results.results.length} results:`);
        results.results.slice(0, 3).forEach((product, idx) => {
          console.log(`   ${idx + 1}. ${product.title || product.name}`);
          if (product.similarity_score) {
            console.log(`      Score: ${(product.similarity_score * 100).toFixed(1)}%`);
          }
          if (product.price) {
            console.log(`      Price: $${product.price}`);
          }
        });
      } else {
        console.log('   ⚠️  No results found');
      }
    } else {
      console.log('   ❌ Search failed or returned invalid response');
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n\n📊 Test Summary');
  console.log('================');
  console.log('These queries demonstrate how neural search understands:');
  console.log('• Conceptual relationships (muscle building → protein)');
  console.log('• User intent (bulk up → mass gainers)');
  console.log('• Natural language (questions and phrases)');
  console.log('• Misspellings and variations');
  console.log('• Context and use cases (post-workout, morning routine)');
}

// Run the tests
runSemanticTests().catch(console.error);