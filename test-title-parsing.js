const { extractPostTitle } = require("./dist/services/wordpress/posts");

// Test cases for HTML title parsing
const testTitles = [
  "Step 3 &#8211; Identifying Narrative Communities",
  "Deep Dive &#8211; Understanding the Narrative Space",
  "Final reflections: Life at the center",
  "Resources",
  "Step 2 &#8211; Listen",
  "Attention, Network and Power",
  "Mapping narrative communities",
  "The Culture of the Anthropocene",
  "Further Reading: Culture and the Anthropocene",
  "Develop your Narrative Strategy",
  "<strong>Bold Title</strong>",
  'Title with <a href="http://example.com">link</a>',
  "Normal title without HTML",
  "&#8220;Quoted Title&#8221;",
  "Title with &amp; ampersand",
];

console.log("Testing HTML title parsing:");
console.log("=".repeat(50));

testTitles.forEach((title, index) => {
  const cleaned = extractPostTitle(title);
  console.log(`${index + 1}. Original: "${title}"`);
  console.log(`   Cleaned:  "${cleaned}"`);
  console.log("");
});

console.log("Test completed!");
