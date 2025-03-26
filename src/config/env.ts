import * as dotenv from "dotenv";
dotenv.config();

export const ENV = {
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
  INFERENCE_PROVIDER: process.env.INFERENCE_PROVIDER,
  HUGGING_FACE_API_TOKEN: process.env.HUGGING_FACE_API_TOKEN,
  PORT: process.env.PORT || "3000",
  MILVUS_ADDRESS: process.env.MILVUS_ADDRESS,
  MILVUS_USERNAME: process.env.MILVUS_USERNAME,
  MILVUS_PASSWORD: process.env.MILVUS_PASSWORD,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
};
