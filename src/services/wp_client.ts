import axios from "axios";
import { ENV } from "../config/env";

import { CurriculumModule, WPPostResponse } from "../types";

// API configuration
const getBaseUrl = (): string => {
  const baseUrl = ENV.WP_API_URL;
  if (!baseUrl) {
    throw new Error("WP_API_URL environment variable is not defined");
  }
  // Ensure the URL doesn't end with a slash to prevent double slashes
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
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
          `Cannot connect to WordPress at ${ENV.WP_API_URL}. Please check if the URL is correct and the WordPress server is running.`
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
