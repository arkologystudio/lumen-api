import express from "express";
import { initMilvusCollection } from "./services/vectorStore";
import embeddingRoutes from "./routes/embeddingRoutes";
import moduleRoute from "./routes/moduleRoute";

const app = express();
const port = process.env.PORT || 3000;

// Add middleware
app.use(express.json());

// Add routes
app.use("/api/embedding", embeddingRoutes);
app.use("/api/modules", moduleRoute);

// Start server only after Milvus is ready
async function startServer() {
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
}

startServer();
