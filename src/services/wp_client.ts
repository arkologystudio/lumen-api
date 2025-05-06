import axios from "axios";
import { ENV } from "../config/env";

import { CurriculumModule, WPPostResponse } from "../types";

// API configuration
const getBaseUrl = (): string => {
  let baseUrl;

  console.log("ENVIRONMENT: ", ENV.NODE_ENV);
  console.log("CORS_ORIGIN_STAGING: ", ENV.CORS_ORIGIN_STAGING);
  console.log("CORS_ORIGIN_PROD: ", ENV.CORS_ORIGIN_PROD);
  console.log("CORS_ORIGIN_DEV: ", ENV.CORS_ORIGIN_DEV);

  switch (ENV.NODE_ENV) {
    case "staging":
      baseUrl = ENV.CORS_ORIGIN_STAGING;
      break;
    case "production":
      baseUrl = ENV.CORS_ORIGIN_PROD;
      break;
    case "development":
      baseUrl = ENV.CORS_ORIGIN_DEV;
      break;
  }

  if (!baseUrl) {
    throw new Error(
      "ENVIRONMENT and ORIGIN variables are not defined. Please check your .env file."
    );
  }

  const endpoint = ENV.WP_API_URL;
  if (!endpoint) {
    throw new Error("WP_API_URL environment variable is not defined");
  }
  const fullEndpoint = `${baseUrl}${endpoint}`;

  // Ensure the URL doesn't end with a slash to prevent double slashes
  return fullEndpoint.endsWith("/") ? fullEndpoint.slice(0, -1) : fullEndpoint;
};

// Pure transformer functions
const transformModuleResponse = (post: WPPostResponse): CurriculumModule => ({
  id: post.id,
  permalink: post.permalink,
  blocks: post.blocks || [],
  title: post.title,
});

// API functions
export const getCurriculumModulesWithBlocks = async (): Promise<
  CurriculumModule[]
> => {
  try {
    const endpoint =
      ENV.WP_USE_CUSTOM_ENDPOINT === "true"
        ? "curriculum-blocks"
        : "posts?type=curriculum-blocks";

    const url = `${getBaseUrl()}/${endpoint}`;
    console.log("Fetching from URL:", url);

    const response = await axios.get<WPPostResponse[]>(url, {
      params: {
        per_page: 100,
        _embed: "true",
        context: "edit",
      },
      headers: {
        Accept: "application/json",
      },
    });

    console.log("Response test: ", response);

    console.log("Response:", response.data[0].blocks[0]);
    return response.data.map(transformModuleResponse);
  } catch (error) {
    console.error("WordPress API error:", error);
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNREFUSED") {
        throw new Error(
          `Cannot connect to WordPress at ${getBaseUrl()} ${
            ENV.WP_API_URL
          }. Please check if the URL is correct and the WordPress server is running.`
        );
      }
      console.error("API Response:", error.response?.data);
    }
    throw new Error("Failed to fetch curriculum modules");
  }
};

export const getCurriculumModuleById = async (
  id: string
): Promise<CurriculumModule | null> => {
  try {
    const endpoint = `post/${id}`;
    console.log("Fetching from URL:", `${getBaseUrl()}/${endpoint}`);
    const response = await axios.get<WPPostResponse>(
      `${getBaseUrl()}/${endpoint}`,
      {
        params: {
          _embed: "true",
          context: "edit", // Required to get block data
        },
      }
    );

    console.log("Response test: ", response);

    return transformModuleResponse(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    console.error("WordPress API error:", error);
    if (axios.isAxiosError(error)) {
      console.error("API Response:", error.response?.data);
    }
    throw new Error("Failed to fetch curriculum module");
  }
};
