import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Helper function to determine the appropriate database URL based on environment
const getDatabaseUrl = (): string => {
  const isVercel = !!process.env.VERCEL;
  const isServerless = isVercel || !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.NETLIFY;
  
  // For serverless environments, prioritize transaction mode (port 6543)
  if (isServerless && process.env.DATABASE_URL_TRANSACTION) {
    return process.env.DATABASE_URL_TRANSACTION;
  }
  
  // For local development, prioritize session mode (port 5432)
  if (!isServerless && process.env.DATABASE_URL_SESSION) {
    return process.env.DATABASE_URL_SESSION;
  }
  
  // Fallback to the default DATABASE_URL
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  throw new Error('No valid DATABASE_URL found. Please set DATABASE_URL, DATABASE_URL_SESSION, or DATABASE_URL_TRANSACTION.');
};

export const ENV = {
  NODE_ENV: process.env.NODE_ENV,
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
  INFERENCE_PROVIDER: process.env.INFERENCE_PROVIDER,
  HUGGING_FACE_API_TOKEN: process.env.HUGGING_FACE_API_TOKEN,
  PORT: process.env.PORT || "3000",
  
  // Database - Environment-specific URL selection
  DATABASE_URL: getDatabaseUrl(),
  DATABASE_URL_SESSION: process.env.DATABASE_URL_SESSION,
  DATABASE_URL_TRANSACTION: process.env.DATABASE_URL_TRANSACTION,
  IS_SERVERLESS: !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.NETLIFY,
  
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

  
  // API Keys
  SERVER_API_KEY: process.env.SERVER_API_KEY!,
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || process.env.SERVER_API_KEY!, // Falls back to SERVER_API_KEY if not set
};
