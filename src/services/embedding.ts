// import {
//   InferenceClient,
//   FeatureExtractionOutput,
// } from "@huggingface/inference";

// export const embedText = async (
//   userQuery: string
// ): Promise<FeatureExtractionOutput> => {
//   try {
//     console.log("Embedding text:", userQuery);
//     console.log("Hugging Face API token:", ENV.HUGGING_FACE_API_TOKEN);
//     console.log("Embedding model:", ENV.EMBEDDING_MODEL);
//     console.log("Inference provider:", ENV.INFERENCE_PROVIDER);
//     // const client = new HfInference(ENV.HUGGING_FACE_API_TOKEN);

//     // const output = await client.featureExtraction({
//     //   model: ENV.EMBEDDING_MODEL,
//     //   inputs: userQuery,
//     //   provider: ENV.INFERENCE_PROVIDER,
//     // });

//     // return output;
//     if (!ENV.HUGGING_FACE_API_TOKEN) {
//       throw new Error("HUGGING_FACE_API_TOKEN is not defined");
//     }
//     const client = new InferenceClient(ENV.HUGGING_FACE_API_TOKEN);
//     console.log("Client created");
//     const embeddingResult = await client.featureExtraction({
//       model: ENV.EMBEDDING_MODEL, // raw "intfloat/multilingual-e5-large"
//       inputs: userQuery,
//     });
//     console.log("Embedding result:", embeddingResult);

//     return embeddingResult;
//   } catch (error) {
//     console.error("Error embedding text:", error);
//     throw error;
//   }
// };

import axios from "axios";
import { ENV } from "../config/env";

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (error: unknown): boolean => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    // Retry on 500 (Internal Server Error), 503 (Service Unavailable), and 429 (Too Many Requests)
    return status === 500 || status === 503 || status === 429;
  }
  return false;
};

/**
 * Embeds text using Hugging Face's inference API with retry logic
 * @param userQuery - Text to embed
 * @returns Array of embedding values
 */
export const embedText = async (userQuery: string): Promise<number[]> => {
  let retryCount = 0;
  let lastError: unknown;

  while (retryCount <= MAX_RETRIES) {
    try {
      // Validate required environment variables
      if (!ENV.HUGGING_FACE_API_TOKEN) {
        console.error(
          "Missing HUGGING_FACE_API_TOKEN in environment variables"
        );
        throw new Error("HUGGING_FACE_API_TOKEN is not defined");
      }

      if (!ENV.EMBEDDING_MODEL) {
        console.error("Missing EMBEDDING_MODEL in environment variables");
        throw new Error("EMBEDDING_MODEL is not defined");
      }

      console.log(`Embedding text with model: ${ENV.EMBEDDING_MODEL}`);

      // Prepare API call
      const model = encodeURIComponent(ENV.EMBEDDING_MODEL);
      const url = `https://api-inference.huggingface.co/models/${model}`;

      // Make the API request with timeout
      const response = await axios.post<number[] | number[][]>(
        url,
        { inputs: userQuery },
        {
          headers: {
            Authorization: `Bearer ${ENV.HUGGING_FACE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          timeout: 30000, // 30 second timeout
        }
      );

      // Process and validate the response
      const { data } = response;

      if (!Array.isArray(data)) {
        console.error("Invalid response format from Hugging Face API:", data);
        throw new Error("Invalid response format: expected array");
      }

      if (data.length === 0) {
        console.error("Empty response array from Hugging Face API");
        throw new Error("Empty embedding array received");
      }

      // Handle both flat and nested array formats
      const embeddingVector = Array.isArray(data[0]) ? data[0] : data;

      if (embeddingVector.length === 0) {
        console.error("Empty embedding vector received");
        throw new Error("Empty embedding vector");
      }

      // Validate that all elements are numbers
      if (!embeddingVector.every((item) => typeof item === "number")) {
        console.error("Invalid embedding format: non-numeric values found");
        throw new Error("Invalid embedding format: expected numeric values");
      }

      console.log(
        `Embedding successful: vector dimension = ${embeddingVector.length}`
      );
      return embeddingVector;
    } catch (error) {
      lastError = error;

      if (shouldRetry(error)) {
        retryCount++;
        if (retryCount <= MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount - 1);
          console.log(
            `Retry attempt ${retryCount}/${MAX_RETRIES} after ${delay}ms delay`
          );
          await sleep(delay);
          continue;
        }
      }

      // If we shouldn't retry or we've exhausted retries, throw the error
      if (axios.isAxiosError(error)) {
        console.error("Axios error embedding text:", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
        });
      } else {
        console.error("Error embedding text:", error);
      }
      throw error;
    }
  }

  // This should never be reached due to the throw in the catch block,
  // but TypeScript needs it for type safety
  throw lastError;
};
