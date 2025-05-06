import { ENV } from "../config/env";
import { HfInference, FeatureExtractionOutput } from "@huggingface/inference";

export const embedText = async (
  userQuery: string
): Promise<FeatureExtractionOutput> => {
  try {
    console.log("Embedding text:", userQuery);
    console.log("Hugging Face API token:", ENV.HUGGING_FACE_API_TOKEN);
    console.log("Embedding model:", ENV.EMBEDDING_MODEL);
    console.log("Inference provider:", ENV.INFERENCE_PROVIDER);
    const client = new HfInference(ENV.HUGGING_FACE_API_TOKEN);

    const output = await client.featureExtraction({
      model: ENV.EMBEDDING_MODEL,
      inputs: userQuery,
      provider: ENV.INFERENCE_PROVIDER,
    });

    return output;
  } catch (error) {
    console.error("Error embedding text:", error);
    throw error;
  }
};
