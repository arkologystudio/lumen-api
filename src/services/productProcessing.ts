/**
 * Product processing service for creating searchable content from product data
 */

import { ProductEmbedRequest, ProductAttributes } from "../types";

export interface ProcessedProduct {
  id: number;
  title: string;
  url: string;
  site_id: string;
  site_name?: string;
  site_url?: string;
  // Searchable content for embeddings
  searchable_text: string;
  structured_data: ProductAttributes;
  price_normalized?: number; // For range filtering
  category_path?: string[]; // For hierarchical filtering
}

/**
 * Convert product data into searchable text for embeddings
 * This creates a rich text representation that captures semantic meaning
 */
export const synthesizeProductText = (product: ProductEmbedRequest): string => {
  const textParts: string[] = [];

  // Core product information
  textParts.push(`Product: ${product.title}`);

  if (product.description) {
    textParts.push(`Description: ${product.description}`);
  }

  if (product.short_description) {
    textParts.push(`Summary: ${product.short_description}`);
  }

  const attrs = product.attributes;

  // Brand and category context
  if (attrs.brand) {
    textParts.push(`Brand: ${attrs.brand}`);
  }

  if (attrs.category) {
    textParts.push(`Category: ${attrs.category}`);
    if (attrs.subcategory) {
      textParts.push(`Subcategory: ${attrs.subcategory}`);
    }
  }

  // Price context for semantic understanding
  if (attrs.price && attrs.currency) {
    const priceText = formatPriceForSearch(attrs.price, attrs.currency);
    textParts.push(`Price: ${priceText}`);
  }

  // Specifications as searchable text
  if (attrs.specifications) {
    const specTexts = Object.entries(attrs.specifications).map(
      ([key, value]) => `${key}: ${value}`
    );
    textParts.push(`Specifications: ${specTexts.join(", ")}`);
  }

  // Tags for discoverability
  if (attrs.tags && attrs.tags.length > 0) {
    textParts.push(`Tags: ${attrs.tags.join(", ")}`);
  }

  // Availability context
  if (attrs.availability) {
    const availabilityText = formatAvailabilityForSearch(attrs.availability);
    textParts.push(`Availability: ${availabilityText}`);
  }

  // Rating context
  if (attrs.rating && attrs.reviews_count) {
    textParts.push(
      `Rated ${attrs.rating} out of 5 with ${attrs.reviews_count} reviews`
    );
  }

  // Physical attributes for search
  if (attrs.weight) {
    textParts.push(`Weight: ${attrs.weight}`);
  }

  if (attrs.dimensions) {
    const dims = attrs.dimensions;
    if (dims.length && dims.width && dims.height) {
      textParts.push(
        `Dimensions: ${dims.length}x${dims.width}x${dims.height} ${
          dims.unit || ""
        }`
      );
    }
  }

  return textParts.join("\n");
};

/**
 * Format price for semantic search understanding
 */
const formatPriceForSearch = (price: number, currency: string): string => {
  const symbol = getCurrencySymbol(currency);

  // Add price range descriptors for better semantic matching
  const descriptors: string[] = [];

  if (price < 25) descriptors.push("budget", "affordable", "cheap");
  else if (price < 100) descriptors.push("moderate", "mid-range");
  else if (price < 500) descriptors.push("premium");
  else descriptors.push("luxury", "high-end", "expensive");

  return `${symbol}${price} (${descriptors.join(", ")})`;
};

/**
 * Format availability for search understanding
 */
const formatAvailabilityForSearch = (
  availability: ProductAttributes["availability"]
): string => {
  const statusMap = {
    in_stock: "in stock, available, ready to ship",
    out_of_stock: "out of stock, unavailable, sold out",
    limited: "limited stock, few remaining, almost sold out",
    pre_order: "pre-order, coming soon, advance order",
  };

  return statusMap[availability || "in_stock"] || "available";
};

/**
 * Get currency symbol for display
 */
const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CAD: "C$",
    AUD: "A$",
  };

  return symbols[currency.toUpperCase()] || currency;
};

/**
 * Normalize price for range filtering (convert to USD equivalent)
 */
export const normalizePriceToUSD = (
  price: number,
  currency: string
): number => {
  // Simplified conversion rates - in production, use a real exchange rate API
  const conversionRates: Record<string, number> = {
    USD: 1.0,
    EUR: 1.08,
    GBP: 1.25,
    CAD: 0.74,
    AUD: 0.66,
    JPY: 0.0067,
  };

  const rate = conversionRates[currency.toUpperCase()] || 1.0;
  return Math.round(price * rate * 100) / 100; // Round to 2 decimal places
};

/**
 * Extract category hierarchy for filtering
 */
export const extractCategoryPath = (attrs: ProductAttributes): string[] => {
  const path: string[] = [];

  if (attrs.category) {
    path.push(attrs.category.toLowerCase());
  }

  if (attrs.subcategory) {
    path.push(attrs.subcategory.toLowerCase());
  }

  return path;
};

/**
 * Process product for embedding and search
 */
export const processProduct = (
  product: ProductEmbedRequest
): ProcessedProduct => {
  const searchableText = synthesizeProductText(product);
  const priceNormalized =
    product.attributes.price && product.attributes.currency
      ? normalizePriceToUSD(
          product.attributes.price,
          product.attributes.currency
        )
      : undefined;
  const categoryPath = extractCategoryPath(product.attributes);

  return {
    id: product.id,
    title: product.title,
    url: product.url,
    site_id: product.site_id,
    site_name: product.site_name,
    site_url: product.site_url,
    searchable_text: searchableText,
    structured_data: product.attributes,
    price_normalized: priceNormalized,
    category_path: categoryPath,
  };
};

/**
 * Batch process products
 */
export const processProductBatch = (
  products: ProductEmbedRequest[]
): ProcessedProduct[] => {
  return products.map(processProduct);
};

/**
 * Generate attribute-based search text for enhanced matching
 */
export const generateAttributeSearchText = (
  attrs: ProductAttributes
): string => {
  const attributeTexts: string[] = [];

  // Common search patterns for products
  if (attrs.brand && attrs.category) {
    attributeTexts.push(`${attrs.brand} ${attrs.category}`);
  }

  if (attrs.price && attrs.currency) {
    const symbol = getCurrencySymbol(attrs.currency);
    attributeTexts.push(`under ${symbol}${attrs.price + 50}`);
    attributeTexts.push(`around ${symbol}${attrs.price}`);
    attributeTexts.push(`${symbol}${attrs.price} range`);
  }

  // Size/specification combinations
  if (attrs.specifications) {
    const specs = attrs.specifications;
    Object.entries(specs).forEach(([key, value]) => {
      attributeTexts.push(`${key} ${value}`);
      attributeTexts.push(`with ${key} ${value}`);
    });
  }

  return attributeTexts.join(" ");
};
