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

// Authentication helper
const getAuthHeaders = (): Record<string, string> => {
  const applicationPassName = ENV.WP_APPLICATION_PASS_NAME;
  const applicationPassPassword = ENV.WP_APPLICATION_PASS_PASSWORD;
  console.log("applicationPassName: ", applicationPassName);
  console.log("applicationPassPassword: ", applicationPassPassword);
  if (!applicationPassName || !applicationPassPassword) {
    console.warn("WordPress authentication credentials not provided");
    return {};
  }

  const token = Buffer.from(
    `${applicationPassName}:${applicationPassPassword}`
  ).toString("base64");
  return {
    Authorization: `Basic ${token}`,
  };
};

// Pure transformer functions
const transformModuleResponse = (post: WPPostResponse): CurriculumModule => {
  // Safely handle missing properties
  if (!post) {
    console.warn("Received null/undefined post in transformModuleResponse");
    throw new Error("Invalid post data: post is null or undefined");
  }

  if (!post.id) {
    console.warn("Post missing required id property:", post);
    throw new Error("Invalid post data: missing id");
  }

  return {
    id: post.id,
    permalink: post.permalink || "",
    blocks: post.blocks || [],
    title: post.title || "",
  };
};

// API functions
export const getCurriculumModulesWithBlocks = async (): Promise<
  CurriculumModule[]
> => {
  try {
    const endpoint = "curriculum-blocks";

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
        ...getAuthHeaders(),
      },
    });

    console.log("Response status:", response.status);
    console.log("Response headers:", response.headers);

    // Safely check if response data exists and has content
    if (!response.data || !Array.isArray(response.data)) {
      console.warn("No valid response data received from WordPress API");
      return [];
    }

    if (response.data.length === 0) {
      console.warn("No curriculum modules found in WordPress API response");
      return [];
    }

    // Safely log the first item if it exists
    const firstModule = response.data[0];
    if (firstModule && firstModule.blocks && firstModule.blocks.length > 0) {
      console.log("First module first block:", firstModule.blocks[0]);
    } else {
      console.log("First module has no blocks or blocks is undefined");
    }

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
      console.error("API Response Status:", error.response?.status);
      console.error("API Response Headers:", error.response?.headers);
      console.error("API Response Data:", error.response?.data);
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
        headers: {
          Accept: "application/json",
          ...getAuthHeaders(),
        },
      }
    );

    console.log("Response test: ", response);

    // Safely check if response data exists
    if (!response.data) {
      console.warn(`No data received for module ID: ${id}`);
      return null;
    }

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
