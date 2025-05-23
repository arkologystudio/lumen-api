import express from "express";
import cors from "cors";
import { initMilvusCollection } from "./services/vectorStore";
import embeddingRoutes from "./routes/embeddingRoutes";
import authRoutes from "./routes/auth";
import moduleRoute from "./routes/moduleRoutes";
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
app.use(express.json());
app.use(
  cors({
    origin: [
      ENV.CORS_ORIGIN_DEV,
      ENV.CORS_ORIGIN_PROD,
      ENV.CORS_ORIGIN_STAGING,
    ],
    methods: ["GET", "POST"],
  })
);

app.get("/", (req, res) => {
  res.send("CHL Service is up and running!");
});

// public: get short-lived JWT
app.use("/api/auth", authRoutes);

// protected: vector-search endpoint
app.use("/api/embedding", embeddingRoutes);

// Add routes
app.use("/api/modules", moduleRoute);

// Start server only after Milvus is ready
const startServer = async () => {
  console.log("Starting server initialization...");

  // Try to initialize Milvus with retries
  let milvusReady = false;
  for (let i = 0; i < 5; i++) {
    console.log(`Attempt ${i + 1} to initialize Milvus...`);
    try {
      await initMilvusCollection();
      milvusReady = true;
      break;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);

      // Wait between retries
      console.log(`Waiting 10 seconds before retry ${i + 2}...`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  if (!milvusReady) {
    console.error(
      "Failed to initialize Milvus after 5 attempts. Starting server anyway..."
    );
  }

  // Start Express server
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
};

// Only start server if this file is run directly
if (require.main === module) {
  //TODO: Check this
  startServer();
}
