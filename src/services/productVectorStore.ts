/**
 * Product vector store service for Milvus
 * Handles product embeddings with structured data and filtering
 */

import { MilvusClient, DataType } from "@zilliz/milvus2-sdk-node";
import { FeatureExtractionOutput } from "@huggingface/inference";
import { ENV } from "../config/env";
import { processProduct, ProcessedProduct } from "./productProcessing";
import {
  ProductEmbedRequest,
  ProductSearchResult,
  SearchFilters,
  ProductAttributes,
} from "../types";
import { embedText } from "./embedding";

// Initialize Milvus client
const milvusClient = new MilvusClient({
  address: ENV.MILVUS_ADDRESS || "standalone:19530",
  username: ENV.MILVUS_USERNAME || "",
  password: ENV.MILVUS_PASSWORD || "",
  timeout: 60000,
});

/**
 * Generate product collection name for a site
 */
const getProductCollectionName = (siteId: string): string => {
  const sanitizedSiteId = siteId.replace(/[^a-zA-Z0-9_]/g, "_");
  return `site_${sanitizedSiteId}_products`;
};

/**
 * Convert embedding output to number array
 */
const convertToNumberArray = (embedding: FeatureExtractionOutput): number[] => {
  if (typeof embedding === "number") {
    return [embedding];
  }

  if (Array.isArray(embedding)) {
    if (embedding.length === 0) return [];

    if (Array.isArray(embedding[0])) {
      if (embedding[0].every((item) => typeof item === "number")) {
        return embedding[0];
      }
      return [];
    }

    if (embedding.every((item) => typeof item === "number")) {
      return embedding;
    }
  }

  return [];
};

/**
 * Create collection schema for products with structured data support
 */
const createProductCollectionSchema = () => [
  {
    name: "pk_id",
    description: "Primary Key",
    data_type: DataType.Int64,
    is_primary_key: true,
    autoID: true,
  },
  {
    name: "product_id",
    description: "Product ID field",
    data_type: DataType.Int64,
    autoID: false,
  },
  {
    name: "title",
    description: "Product title",
    data_type: DataType.VarChar,
    max_length: 512,
  },
  {
    name: "url",
    description: "Product URL",
    data_type: DataType.VarChar,
    max_length: 512,
  },
  {
    name: "site_id",
    description: "Site ID field",
    data_type: DataType.VarChar,
    max_length: 128,
  },
  {
    name: "site_name",
    description: "Site name field",
    data_type: DataType.VarChar,
    max_length: 256,
  },
  {
    name: "site_url",
    description: "Site URL field",
    data_type: DataType.VarChar,
    max_length: 512,
  },
  // Product-specific fields
  {
    name: "brand",
    description: "Product brand",
    data_type: DataType.VarChar,
    max_length: 256,
  },
  {
    name: "category",
    description: "Product category",
    data_type: DataType.VarChar,
    max_length: 256,
  },
  {
    name: "price_usd",
    description: "Normalized price in USD",
    data_type: DataType.Float,
  },
  {
    name: "rating",
    description: "Product rating",
    data_type: DataType.Float,
  },
  {
    name: "availability",
    description: "Product availability status",
    data_type: DataType.VarChar,
    max_length: 64,
  },
  {
    name: "searchable_text",
    description: "Synthesized searchable content",
    data_type: DataType.VarChar,
    max_length: 65535,
  },
  {
    name: "structured_data",
    description: "JSON string of structured product data",
    data_type: DataType.VarChar,
    max_length: 32768,
  },
  {
    name: "embedding",
    description: "Vector field",
    data_type: DataType.FloatVector,
    dim: 1024,
  },
];

/**
 * Initialize product collection for a specific site
 */
export const initProductCollection = async (
  siteId: string
): Promise<string> => {
  const collectionName = getProductCollectionName(siteId);

  try {
    const hasCollection = await milvusClient.hasCollection({
      collection_name: collectionName,
    });

    if (!hasCollection.value) {
      await milvusClient.createCollection({
        collection_name: collectionName,
        fields: createProductCollectionSchema(),
      });

      // Create index for vector search
      await milvusClient.createIndex({
        collection_name: collectionName,
        field_name: "embedding",
        index_type: "IVF_FLAT",
        metric_type: "COSINE",
        params: { nlist: 1024 },
      });

      await milvusClient.loadCollection({
        collection_name: collectionName,
      });

      console.log(`Created and loaded product collection: ${collectionName}`);
    } else {
      await milvusClient.loadCollection({
        collection_name: collectionName,
      });
      console.log(
        `Product collection already exists and loaded: ${collectionName}`
      );
    }

    return collectionName;
  } catch (error) {
    console.error(
      `Failed to initialize product collection for site ${siteId}:`,
      error
    );
    throw error;
  }
};

/**
 * Search products in a site
 */
export const queryProductSearch = async (
  siteId: string,
  query: string,
  filters: SearchFilters = {},
  topK: number = 10
): Promise<ProductSearchResult[]> => {
  const collectionName = getProductCollectionName(siteId);

  try {
    // Check if collection exists
    const hasCollection = await milvusClient.hasCollection({
      collection_name: collectionName,
    });

    if (!hasCollection.value) {
      console.log(`Product collection ${collectionName} does not exist`);
      return [];
    }

    // Generate embedding for search query
    const queryEmbedding = await embedText(query);
    const embeddingArray = convertToNumberArray(queryEmbedding);

    if (embeddingArray.length === 0) {
      console.error("Failed to generate embedding for query");
      return [];
    }

    // Search parameters
    const searchParams = {
      collection_name: collectionName,
      vector: embeddingArray,
      limit: topK,
      output_fields: [
        "product_id",
        "title",
        "url",
        "site_id",
        "site_name",
        "site_url",
        "searchable_text",
        "structured_data",
      ],
      params: {
        nprobe: 10,
      },
    };

    const searchResult = await milvusClient.search(searchParams);

    if (!searchResult.results || searchResult.results.length === 0) {
      return [];
    }

    // Process search results
    const results: ProductSearchResult[] = searchResult.results.map(
      (result: any) => {
        const structuredData: ProductAttributes = JSON.parse(
          result.structured_data || "{}"
        );

        return {
          id: result.product_id,
          type: "product" as const,
          title: result.title,
          description: structuredData.sku || "",
          url: result.url,
          score: result.score,
          attributes: structuredData,
          matched_text: result.searchable_text?.substring(0, 200) + "..." || "",
          site_id: result.site_id,
          site_name: result.site_name,
          site_url: result.site_url,
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
  const collectionName = getProductCollectionName(siteId);

  try {
    const hasCollection = await milvusClient.hasCollection({
      collection_name: collectionName,
    });

    if (!hasCollection.value) {
      return {
        siteId,
        collectionName,
        productCount: 0,
        exists: false,
      };
    }

    const countResult = await milvusClient.query({
      collection_name: collectionName,
      expr: "product_id > 0",
      output_fields: ["count(*)"],
    });

    const productCount = countResult.data?.[0]?.["count(*)"] || 0;

    return {
      siteId,
      collectionName,
      productCount,
      exists: true,
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
