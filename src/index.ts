import express from "express";
import cors from "cors";
// Import new route modules
import authRoutes from "./routes/auth";
import userRoutes from "./routes/userRoutes";
import siteRoutes from "./routes/siteRoutes";
import adminRoutes from "./routes/adminRoutes";
import productRoutes from "./routes/productRoutes";
import ecosystemProductRoutes from "./routes/ecosystemProductRoutes";
import adminEcosystemProductRoutes from "./routes/adminEcosystemProductRoutes";
import activityRoutes from "./routes/activityRoutes";
import adminActivityRoutes from "./routes/adminActivityRoutes";
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
import { initializeEcosystemProducts } from "./services/ecosystemProductService";
import { initializePluginStorage } from "./services/pluginService";

export const app = express();
const port = process.env.PORT || 3000;

// trust proxy
app.set("trust proxy", 1);

// global middleware
app.use(helmet());
app.use(morgan("combined"));
app.use(express.json({ limit: "50mb" })); // Increase payload limit for large embedding requests
app.use(
  cors({
    origin: [
      ENV.CORS_ORIGIN_DEV,
      ENV.CORS_ORIGIN_PROD,
      ENV.CORS_ORIGIN_STAGING,
      ENV.CORS_ORIGIN_DASHBOARD_DEV,
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
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

// Activity logging routes (protected)
app.use("/api/users", activityRoutes);

// Admin ecosystem product routes (API key protected)
app.use("/api/admin", adminEcosystemProductRoutes);

// Admin activity routes (API key protected)
app.use("/api/admin", adminActivityRoutes);

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
  console.log("Starting Lumen Neural Search API server...");
  console.log("Using Supabase for database, vector embeddings, and file storage");

  // Initialize ecosystem products
  try {
    await initializeEcosystemProducts();
  } catch (error) {
    console.error("Warning: Failed to initialize ecosystem products:", error);
    // Don't block server startup on ecosystem product initialization failure
  }

  // Initialize Supabase Storage for plugin files
  try {
    await initializePluginStorage();
  } catch (error) {
    console.error("Warning: Failed to initialize Supabase Storage:", error);
    // Don't block server startup on storage initialization failure
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
║  📈 Activity Logs:         /api/users/activities              ║
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
