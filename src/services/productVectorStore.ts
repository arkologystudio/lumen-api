/**
 * Product vector store service for PostgreSQL with pgvector
 * Handles product embeddings with structured data and filtering
 */

import { prisma } from "../config/database";
// import { ENV } from "../config/env";
// import { processProduct, ProcessedProduct } from "./productProcessing";
import {

  ProductSearchResult,
  SearchFilters,
  ProductAttributes,
} from "../types";
import { embedText } from "./embedding";

/**
 * Convert embedding output to number array
 */
const convertToNumberArray = (embedding: number[]): number[] => {
  if (Array.isArray(embedding)) {
    if (embedding.length === 0) return [];
    if (embedding.every((item) => typeof item === "number")) {
      return embedding;
    }
  }
  return [];
};

/**
 * Initialize product collection for a specific site (no-op for PostgreSQL)
 */
export const initProductCollection = async (
  siteId: string
): Promise<string> => {
  console.log(`Product embeddings for site ${siteId} managed via PostgreSQL/Prisma`);
  return `site_${siteId}_products`; // Return collection name for compatibility
};

/**
 * Upsert a product embedding
 */
export const upsertProductEmbedding = async (
  siteId: string,
  productData: {
    product_id: number;
    title: string;
    url: string;
    brand?: string;
    category?: string;
    price_usd?: number;
    rating?: number;
    availability?: string;
    searchable_text: string;
    structured_data?: ProductAttributes;
  }
): Promise<void> => {
  try {
    console.log(`Upserting product embedding for product ${productData.product_id} in site ${siteId}`);

    // Generate embedding for searchable text
    const embeddingResult = await embedText(productData.searchable_text);
    const embedding = convertToNumberArray(embeddingResult);

    if (embedding.length === 0) {
      console.error("Failed to generate valid embedding for product");
      return;
    }

    // Convert embedding array to PostgreSQL vector format
    const embeddingVector = `[${embedding.join(",")}]`;

    // Use findFirst/create pattern instead of upsert
    const existingEmbedding = await prisma.productEmbedding.findFirst({
      where: {
        site_id: siteId,
        product_id: productData.product_id,
      },
    });

         if (existingEmbedding) {
       // Use raw SQL for updating with vector data
       await prisma.$executeRaw`
         UPDATE product_embeddings 
         SET title = ${productData.title},
             url = ${productData.url},
             brand = ${productData.brand || null},
             category = ${productData.category || null},
             price_usd = ${productData.price_usd || null},
             rating = ${productData.rating || null},
             availability = ${productData.availability || null},
             searchable_text = ${productData.searchable_text},
             structured_data = ${productData.structured_data ? JSON.stringify(productData.structured_data) : null}::jsonb,
             embedding = ${embeddingVector}::vector,
             updated_at = NOW()
         WHERE id = ${existingEmbedding.id}
       `;
     } else {
       // Use raw SQL for creating with vector data
       await prisma.$executeRaw`
         INSERT INTO product_embeddings (id, site_id, product_id, title, url, brand, category, price_usd, rating, availability, searchable_text, structured_data, embedding, created_at, updated_at)
         VALUES (gen_random_uuid(), ${siteId}, ${productData.product_id}, ${productData.title}, ${productData.url}, ${productData.brand || null}, ${productData.category || null}, ${productData.price_usd || null}, ${productData.rating || null}, ${productData.availability || null}, ${productData.searchable_text}, ${productData.structured_data ? JSON.stringify(productData.structured_data) : null}::jsonb, ${embeddingVector}::vector, NOW(), NOW())
       `;
     }

    console.log(`Successfully upserted product embedding for product ${productData.product_id}`);
  } catch (error) {
    console.error(`Error upserting product embedding for product ${productData.product_id}:`, error);
    throw error;
  }
};

/**
 * Search products in a site using pgvector similarity search
 */
export const queryProductSearch = async (
  siteId: string,
  query: string,
  filters: SearchFilters = {},
  topK: number = 10
): Promise<ProductSearchResult[]> => {
  try {
    console.log(`Searching products for site ${siteId} with query: "${query}"`);

    // Generate embedding for search query
    const queryEmbeddingResult = await embedText(query);
    const queryEmbedding = `[${queryEmbeddingResult.join(",")}]`;

    if (queryEmbeddingResult.length === 0) {
      console.error("Failed to generate embedding for query");
      return [];
    }

         // Build WHERE clauses for filters
     const whereConditions = [`site_id = '${siteId}'`, 'embedding IS NOT NULL'];
     
     // Add basic filters if they exist in the SearchFilters interface
     if (filters.category) {
       whereConditions.push(`category = '${filters.category}'`);
     }
     
     if (filters.brand) {
       whereConditions.push(`brand = '${filters.brand}'`);
     }

     const whereClause = whereConditions.join(' AND ');

    // Use raw SQL for vector similarity search with pgvector
    const searchResults = await prisma.$queryRaw<Array<{
      id: string;
      product_id: number;
      title: string;
      url: string;
      brand: string | null;
      category: string | null;
      price_usd: number | null;
      rating: number | null;
      availability: string | null;
      searchable_text: string;
      structured_data: any;
      similarity: number;
    }>>`
      SELECT 
        id,
        product_id,
        title,
        url,
        brand,
        category,
        price_usd,
        rating,
        availability,
        searchable_text,
        structured_data,
        (1 - (embedding <=> ${queryEmbedding}::vector)) as similarity
      FROM product_embeddings 
      WHERE ${whereClause}
      ORDER BY embedding <=> ${queryEmbedding}::vector
      LIMIT ${topK}
    `;

    // Process search results
    const results: ProductSearchResult[] = searchResults.map(
      (result: {
        id: string;
        product_id: number;
        title: string;
        url: string;
        brand: string | null;
        category: string | null;
        price_usd: number | null;
        rating: number | null;
        availability: string | null;
        searchable_text: string;
        structured_data: any;
        similarity: number;
      }) => {
        const structuredData: ProductAttributes = result.structured_data || {};

        return {
          id: result.product_id,
          type: "product" as const,
          title: result.title,
          description: structuredData.sku || "",
          url: result.url,
          score: result.similarity,
          attributes: {
            brand: result.brand || undefined,
            category: result.category || undefined,
            price_usd: result.price_usd || undefined,
            rating: result.rating || undefined,
            availability: (result.availability as "in_stock" | "out_of_stock" | "limited" | "pre_order") || undefined,
            ...structuredData,
          },
          matched_text: result.searchable_text?.substring(0, 200) + "..." || "",
          site_id: siteId,
          site_name: "", // Would need to be fetched from Site table if needed
          site_url: "", // Would need to be fetched from Site table if needed
        };
      }
    );

    console.log(`Found ${results.length} products for query: "${query}"`);
    return results;
  } catch (error) {
    console.error(`Error searching products in site ${siteId}:`, error);
    return [];
  }
};

/**
 * Get product collection statistics
 */
export const getProductStats = async (
  siteId: string
): Promise<{
  siteId: string;
  collectionName: string;
  productCount: number;
  exists: boolean;
}> => {
  const collectionName = `site_${siteId}_products`;

  try {
    // Use raw SQL to count products with embeddings
    const result = await prisma.$queryRaw<{count: string}[]>`
      SELECT COUNT(*)::text as count
      FROM product_embeddings 
      WHERE site_id = ${siteId} AND embedding IS NOT NULL
    `;
    const productCount = parseInt(result[0]?.count || '0');

    return {
      siteId,
      collectionName,
      productCount,
      exists: productCount > 0,
    };
  } catch (error) {
    console.error(`Error getting product stats for site ${siteId}:`, error);
    return {
      siteId,
      collectionName,
      productCount: 0,
      exists: false,
    };
  }
};

/**
 * Delete all product embeddings for a site
 */
export const dropProductCollection = async (siteId: string): Promise<void> => {
  try {
    await prisma.productEmbedding.deleteMany({
      where: {
        site_id: siteId,
      },
    });
    console.log(`Product embeddings deleted for site ${siteId}`);
  } catch (error) {
    console.error(`Failed to delete product embeddings for site ${siteId}:`, error);
    throw error;
  }
};

/**
 * Get product embeddings count for a site
 */
export const getProductEmbeddingsCount = async (siteId: string): Promise<number> => {
  try {
    // Use raw SQL to count products with embeddings
    const result = await prisma.$queryRaw<{count: string}[]>`
      SELECT COUNT(*)::text as count
      FROM product_embeddings 
      WHERE site_id = ${siteId} AND embedding IS NOT NULL
    `;
    return parseInt(result[0]?.count || '0');
  } catch (error) {
    console.error(`Error getting product embeddings count for site ${siteId}:`, error);
    return 0;
  }
};
