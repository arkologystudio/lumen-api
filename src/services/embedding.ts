import { ENV } from "../config/env";
import { HfInference, FeatureExtractionOutput } from "@huggingface/inference";

export const embedText = async (
  userQuery: string
): Promise<FeatureExtractionOutput> => {
  const client = new HfInference(ENV.HUGGING_FACE_API_TOKEN);

  const output = await client.featureExtraction({
    model: ENV.EMBEDDING_MODEL,
    inputs: userQuery,
    provider: ENV.INFERENCE_PROVIDER,
  });

  return output;
};
