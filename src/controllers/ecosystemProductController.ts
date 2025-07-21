/**
 * Product Controller
 * Handles product management and site registrations (unified from ecosystem products and plugins)
 */

import { Request, Response } from "express";
import {
  getAllProducts,
  getProductsByCategory,
  getProductBySlug,
} from "../services/ecosystemProductService";

/**
 * Get all available products
 */
export const getAllProductsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { category } = req.query;

    let products;
    if (category && typeof category === "string") {
      products = await getProductsByCategory(category);
    } else {
      products = await getAllProducts();
    }

    res.json({
      success: true,
      products,
      total: products.length,
    });
  } catch (error) {
    console.error("Error getting products:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get products",
    });
  }
};

/**
 * Get specific product by slug
 */
export const getProductBySlugController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { slug } = req.params;

    const product = await getProductBySlug(slug);
    if (!product) {
      res.status(404).json({
        success: false,
        error: "Product not found",
      });
      return;
    }

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Error getting product:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get product",
    });
  }
};

/**
 * Get all product categories
 */
export const getProductCategoriesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const products = await getAllProducts();
    const categories = Array.from(
      new Set(products.map((product) => product.category))
    ).sort();

    res.json({
      success: true,
      categories,
      total: categories.length,
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get categories",
    });
  }
};
