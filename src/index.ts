import express from "express";
import cors from "cors";
// Multi-site vector store doesn't need global initialization
import embeddingRoutes from "./routes/embeddingRoutes";
import authRoutes from "./routes/auth";
// import moduleRoute from "./routes/moduleRoutes";
import helmet from "helmet";
import morgan from "morgan";
import { ENV } from "./config/env";
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
    ],
    methods: ["GET", "POST", "DELETE"],
  })
);

app.get("/", (req, res) => {
  res.send("CHL Service is up and running!");
});

// public: get short-lived JWT
app.use("/api/auth", authRoutes);

// protected: vector-search endpoint
app.use("/api/embedding", embeddingRoutes);

// Start server - collections are created on-demand per site
const startServer = async () => {
  console.log("Starting server initialization...");
  console.log(
    "Multi-site vector store: Collections will be created on-demand per site"
  );

  // Start Express server
  const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  // Set server timeouts for long-running operations like embedding
  server.keepAliveTimeout = 300000; // 5 minutes
  server.headersTimeout = 310000; // 5 minutes + 10 seconds
  server.timeout = 300000; // 5 minutes

  console.log("Server timeouts configured for long-running operations");
};

// Only start server if this file is run directly
if (require.main === module) {
  //TODO: Check this
  startServer();
}
