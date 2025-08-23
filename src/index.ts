import express from "express";
import cors from "cors";
import { createDynamicOriginHandler } from "./services/corsService";
// Import new route modules
import authRoutes from "./routes/auth";
import userRoutes from "./routes/userRoutes";
import siteRoutes from "./routes/siteRoutes";
import adminRoutes from "./routes/adminRoutes";
import productRoutes from "./routes/productRoutes";
import ecosystemProductRoutes from "./routes/ecosystemProductRoutes";

import adminActivityRoutes from "./routes/adminActivityRoutes";
// API Key management routes
import apiKeyRoutes from "./routes/apiKeyRoutes";
// Licensing routes
import licenseRoutes from "./routes/licenseRoutes";
import downloadRoutes from "./routes/downloadRoutes";
import purchaseRoutes from "./routes/purchaseRoutes";
import pricingRoutes from "./routes/pricingRoutes";
// Legacy routes for backward compatibility
import embeddingRoutes from "./routes/embeddingRoutes";
import helmet from "helmet";
import morgan from "morgan";
import { ENV } from "./config/env";
import { initializeProductsIfNeeded } from "./services/databaseManagement";
import { initializeStorage } from "./services/supabaseStorage";


const app = express();
const port = process.env.PORT || 4000;

// trust proxy
app.set("trust proxy", 1);

// global middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  contentSecurityPolicy: false  // Disable CSP for now to test
}));
app.use(morgan("combined"));
app.use(express.json({ limit: "50mb" })); // Increase payload limit for large embedding requests
// Log CORS configuration for debugging
console.log("CORS Configuration:", {
  DASHBOARD_DEV: ENV.CORS_ORIGIN_DASHBOARD_DEV,
  DASHBOARD_STAGING: ENV.CORS_ORIGIN_DASHBOARD_STAGING,
  DASHBOARD_PROD: ENV.CORS_ORIGIN_DASHBOARD_PROD,
});

app.use(
  cors({
    origin: createDynamicOriginHandler([
      ENV.CORS_ORIGIN_DASHBOARD_STAGING,
      ENV.CORS_ORIGIN_DASHBOARD_PROD,
      ENV.CORS_ORIGIN_DASHBOARD_DEV,
    ]),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true, // Allow credentials for authenticated requests
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "x-admin-key"],
    exposedHeaders: ["Content-Length", "Content-Type"],
    maxAge: 86400, // Cache preflight for 24 hours
  })
);

app.get("/", (req, res) => {
  res.send("Lumen Neural Search API is up and running!");
});

// ── API ROUTES ──────────────────────────────────────────────────────────────

// Authentication routes (public)
app.use("/api/auth", authRoutes);

// User management routes (protected)
app.use("/api/users", userRoutes);

// Site management routes (protected)
app.use("/api/sites", siteRoutes);

// Admin routes (API key protected)
app.use("/api/admin", adminRoutes);

// Product search routes (protected)
app.use("/api/products", productRoutes);

// Ecosystem product management routes
app.use("/api/ecosystem", ecosystemProductRoutes);

// Admin activity routes (API key protected)
app.use("/api/admin", adminActivityRoutes);

// API Key management routes (user authentication required)
app.use("/api/api-keys", apiKeyRoutes);

// ── LICENSING SYSTEM ROUTES ─────────────────────────────────────────────────
// License management routes
app.use("/api/licenses", licenseRoutes);

// Plugin download routes
app.use("/api/downloads", downloadRoutes);

// Purchase simulation routes
app.use("/api/purchases", purchaseRoutes);

// Pricing and billing routes (public)
app.use("/api/pricing", pricingRoutes);

// ── LEGACY ROUTES (for backward compatibility) ─────────────────────────────
app.use("/api/embedding", embeddingRoutes);

// Start server - using Supabase for all storage needs
const startServer = async () => {
  try {
    console.log("🚀 Starting Lumen API server...");
    console.log("Using Supabase for database, vector embeddings, and file storage");

    // Initialize storage buckets
    console.log("📦 Initializing storage buckets...");
    await initializeStorage();
    console.log("✅ Storage initialization completed");

    // Initialize products from config if needed (with tracking)
    console.log("🛍️ Checking product initialization...");
    await initializeProductsIfNeeded();
    
    console.log("✅ All initialization completed successfully");
    console.log("💡 Database Management Endpoints:");
    console.log("   GET  /api/admin/database/status - Check initialization status");
    console.log("   POST /api/admin/database/reset - Reset entire database");
    console.log("   POST /api/admin/database/reset-and-reinitialize - Reset and reinitialize");
    console.log("   POST /api/admin/database/force-reinitialize-products - Force reinitialize products");
  } catch (error) {
    console.error("❌ Initialization failed:", error);
    process.exit(1);
  }

  // Start Express server
  const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    Lumen Neural Search API                    ║
║                                                               ║
║  🔐 Authentication:        /api/auth                          ║
║  👤 User Management:       /api/users                         ║
║  🌐 Site Management:       /api/sites                         ║
║  🛍️  Product Search:       /api/products                      ║
║  🏢 Ecosystem Products:    /api/ecosystem                     ║
║  📈 User Activities:       /api/users/activities              ║
║  📈 Site Activities:       /api/sites/:id/activities         ║
║  🔧 Admin Functions:       /api/admin                         ║
║  ⚙️  Admin Ecosystem:      /api/admin/ecosystem               ║
║  📊 Admin Activities:      /api/admin/activities              ║
║  🔐 License Management:    /api/licenses                      ║
║  📥 Plugin Downloads:      /api/downloads                     ║
║  💰 Purchase Simulation:   /api/purchases                     ║
║  📡 Legacy Embedding:      /api/embedding                     ║
║                                                               ║
║  Ready to power neural search for your websites! 🚀          ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });

  // Set server timeouts for long-running operations like embedding
  server.keepAliveTimeout = 300000; // 5 minutes
  server.headersTimeout = 310000; // 5 minutes + 10 seconds
  server.timeout = 300000; // 5 minutes

  console.log("Server timeouts configured for long-running operations");
};

// Only start server if this file is run directly
if (require.main === module) {
  startServer();
}

// Export app for Vercel
export default app;
