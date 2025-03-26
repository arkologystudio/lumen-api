import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import { ENV } from "../src/config/env";

async function initializeMilvus() {
  const client = new MilvusClient({
    address: ENV.MILVUS_ADDRESS || "localhost:19530",
    username: ENV.MILVUS_USERNAME,
    password: ENV.MILVUS_PASSWORD,
  });

  try {
    // Create collection
    await client.createCollection({
      collection_name: "curriculum_modules",
      dimension: 384, // This should match your embedding model's output dimension
      fields: [
        {
          name: "id",
          description: "Module ID",
          data_type: "Int64",
          is_primary_key: true,
          autoID: false,
        },
        {
          name: "embedding",
          description: "Vector embedding of content",
          data_type: "FloatVector",
          dim: 384, // Same as dimension above
        },
        {
          name: "title",
          description: "Module title",
          data_type: "VarChar",
          max_length: 255,
        },
        {
          name: "content",
          description: "Module content",
          data_type: "VarChar",
          max_length: 65535,
        },
        {
          name: "url",
          description: "Module URL",
          data_type: "VarChar",
          max_length: 512,
        },
      ],
    });

    // Create index for vector search
    await client.createIndex({
      collection_name: "curriculum_modules",
      field_name: "embedding",
      index_type: "IVF_FLAT",
      metric_type: "L2",
      params: { nlist: 1024 },
    });

    // Load collection into memory
    await client.loadCollection({
      collection_name: "curriculum_modules",
    });

    console.log("Milvus collection initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Milvus:", error);
    throw error;
  }
}

// Run initialization
initializeMilvus().catch(console.error);
