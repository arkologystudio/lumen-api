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
export const embedText = async (userQuery: string): Promise<number[]> => {
  try {
    if (!ENV.HUGGING_FACE_API_TOKEN || !ENV.EMBEDDING_MODEL) {
      throw new Error(
        "HUGGING_FACE_API_TOKEN or EMBEDDING_MODEL is not defined"
      );
    }
    const model = encodeURIComponent(ENV.EMBEDDING_MODEL); // safe for slashes
    const url = `https://api-inference.huggingface.co/models/${model}`;

    const { data } = await axios.post<number[][]>(
      url,
      { inputs: userQuery },
      {
        headers: {
          Authorization: `Bearer ${ENV.HUGGING_FACE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // data is [[…]] so return the first row
    return Array.isArray(data) && Array.isArray(data[0]) ? data[0] : [];
  } catch (error) {
    console.error("Error embedding text:", error);
    throw error;
  }
};
