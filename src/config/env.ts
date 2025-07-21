import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV,
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
  INFERENCE_PROVIDER: process.env.INFERENCE_PROVIDER,
  HUGGING_FACE_API_TOKEN: process.env.HUGGING_FACE_API_TOKEN,
  PORT: process.env.PORT || "3000",
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  
  // WordPress Configuration (optional)
  WP_API_URL: process.env.WP_API_URL,
  WP_APPLICATION_PASS_PASSWORD: process.env.WP_APPLICATION_PASS_PASSWORD,
  WP_APPLICATION_PASS_NAME: process.env.WP_APPLICATION_PASS_NAME,
  
  // Search threshold
  SEARCH_THRESHOLD: process.env.THRESHOLD,
  
  // Authentication
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_TTL: process.env.JWT_TTL!,
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS!),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX!),
  

  
  // CORS Origins

  CORS_ORIGIN_DASHBOARD_DEV: process.env.CORS_ORIGIN_DASHBOARD_DEV!,
  CORS_ORIGIN_DASHBOARD_STAGING: process.env.CORS_ORIGIN_DASHBOARD_STAGING!,
  CORS_ORIGIN_DASHBOARD_PROD: process.env.CORS_ORIGIN_DASHBOARD_PROD!,

  
  // Server API Key
  SERVER_API_KEY: process.env.SERVER_API_KEY!,
};
