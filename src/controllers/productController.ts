/**
 * Product controller for handling product embedding and search operations
 */

import { Request, Response } from "express";
import {
  ProductEmbedRequest,
  SearchRequest,
  SearchFilters,
} from "../types";
import {
  initProductCollection,
  queryProductSearch,
} from "../services/productVectorStore";
import { processProductBatch } from "../services/productProcessing";
import { embedText } from "../services/embedding";

/**
 * Embed a single product
 */
export const embedProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const productData = req.body as ProductEmbedRequest;

    // Validate required fields
    if (!productData.id || !productData.title || !productData.site_id) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: id, title, site_id",
      });
      return;
    }

    // Ensure type is set to product
    productData.type = "product";

    // Process the product
    const processedProducts = processProductBatch([productData]);

    if (processedProducts.length === 0) {
      res.status(400).json({
        success: false,
        error: "Failed to process product data",
      });
      return;
    }

    const processed = processedProducts[0];

    // Generate embedding
    const embedding = await embedText(processed.searchable_text);

    res.json({
      success: true,
      data: {
        product_id: processed.id,
        title: processed.title,
        site_id: processed.site_id,
        searchable_text: processed.searchable_text,
        price_normalized: processed.price_normalized,
        category_path: processed.category_path,
        embedding_generated: true,
        embedding_dimension: Array.isArray(embedding) ? embedding.length : 0,
      },
    });
  } catch (error) {
    console.error("Error embedding product:", error);
    res.status(500).json({
      success: false,
      error: "Failed to embed product",
    });
  }
};

/**
 * Embed multiple products in batch
 */
export const embedProductBatch = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { site_id, products } = req.body as {
      site_id: string;
      products: ProductEmbedRequest[];
    };

    if (!site_id || !products || !Array.isArray(products)) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: site_id, products (array)",
      });
      return;
    }

    if (products.length === 0) {
      res.json({
        success: true,
        data: {
          site_id,
          processed_count: 0,
          embedded_count: 0,
        },
      });
      return;
    }

    // Set type and site_id for all products
    const normalizedProducts = products.map((product) => ({
      ...product,
      type: "product" as const,
      site_id,
    }));

    // Initialize product collection
    await initProductCollection(site_id);

    // Process products (this will be handled by a separate embedding service)
    const processedProducts = processProductBatch(normalizedProducts);

    res.json({
      success: true,
      data: {
        site_id,
        processed_count: processedProducts.length,
        embedded_count: processedProducts.length,
        message:
          "Products processed successfully. Embeddings will be generated asynchronously.",
      },
    });
  } catch (error) {
    console.error("Error embedding product batch:", error);
    res.status(500).json({
      success: false,
      error: "Failed to embed product batch",
    });
  }
};

/**
 * Search products
 */
export const searchProducts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      query,
      site_id,
      filters = {},
      limit = 10,
      min_score = 0.0,
    } = req.body as SearchRequest;

    if (!query || !site_id) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: query, site_id",
      });
      return;
    }

    // Perform product search
    const results = await queryProductSearch(
      site_id,
      query,
      filters as SearchFilters,
      limit
    );

    // Filter by minimum score
    const filteredResults = results.filter(
      (result) => result.score >= min_score
    );

    // Don't fail the request if usage tracking fails
    try {
      // Track usage for Neural Search - Product
      // trackProductUsage(site_id, "neural-search-product").catch((error) => {
      //   console.warn("Failed to track product search usage:", error);
      // });
    } catch (error: any) {
      console.error("Search completed but usage tracking failed:", error);
    }

    res.json({
      success: true,
      data: {
        results: filteredResults,
        total_results: filteredResults.length,
        query,
        site_id,
        content_type: "product",
        filters_applied: Object.keys(filters).length > 0 ? filters : null,
      },
    });
  } catch (error) {
    console.error("Error searching products:", error);
    res.status(500).json({
      success: false,
      error: "Failed to search products",
    });
  }
};

/**
 * Get product search suggestions based on attributes
 */
export const getProductSuggestions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { site_id, category, brand, price_range } = req.query as {
      site_id: string;
      category?: string;
      brand?: string;
      price_range?: string;
    };

    if (!site_id) {
      res.status(400).json({
        success: false,
        error: "Missing required parameter: site_id",
      });
      return;
    }

    // Build suggestion query based on filters
    const suggestions: string[] = [];

    if (category) {
      suggestions.push(`${category} products`);
      suggestions.push(`best ${category}`);
      suggestions.push(`${category} recommendations`);
    }

    if (brand) {
      suggestions.push(`${brand} products`);
      if (category) {
        suggestions.push(`${brand} ${category}`);
      }
    }

    if (price_range) {
      const [min, max] = price_range.split("-").map((p) => parseInt(p));
      if (min && max) {
        suggestions.push(`products under $${max}`);
        suggestions.push(`affordable ${category || "products"}`);
        if (min > 100) {
          suggestions.push(`premium ${category || "products"}`);
        }
      }
    }

    // Add generic suggestions
    suggestions.push(
      "popular products",
      "best sellers",
      "new arrivals",
      "featured items"
    );

    res.json({
      success: true,
      data: {
        suggestions: suggestions.slice(0, 8), // Limit to 8 suggestions
        site_id,
        generated_from: { category, brand, price_range },
      },
    });
  } catch (error) {
    console.error("Error getting product suggestions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get product suggestions",
    });
  }
};

/**
 * Validate product data structure
 */
export const validateProductData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const productData = req.body as ProductEmbedRequest;

    const validation = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      suggestions: [] as string[],
    };

    // Required fields
    if (!productData.id) validation.errors.push("Missing required field: id");
    if (!productData.title)
      validation.errors.push("Missing required field: title");
    if (!productData.site_id)
      validation.errors.push("Missing required field: site_id");
    if (!productData.description)
      validation.warnings.push(
        "Missing description - may impact search quality"
      );

    // Validate attributes
    if (!productData.attributes) {
      validation.warnings.push(
        "No attributes provided - consider adding price, category, brand for better search"
      );
    } else {
      const attrs = productData.attributes;

      if (!attrs.price)
        validation.suggestions.push("Add price for price-based filtering");
      if (!attrs.category)
        validation.suggestions.push("Add category for better organization");
      if (!attrs.brand)
        validation.suggestions.push("Add brand for brand-based search");
      if (!attrs.availability)
        validation.suggestions.push("Add availability status");

      // Validate price format
      if (attrs.price && (!attrs.currency || attrs.price <= 0)) {
        validation.warnings.push(
          "Price should be positive and include currency"
        );
      }
    }

    validation.valid = validation.errors.length === 0;

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    console.error("Error validating product data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to validate product data",
    });
  }
};
