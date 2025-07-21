/**
 * API Key Service
 * Service for managing database-backed API keys with scopes
 */

import { prisma } from "../config/database";
import crypto from "crypto";

type PrismaApiKey = Awaited<ReturnType<typeof prisma.apiKey.findFirst>>;

export interface CreateApiKeyOptions {
  user_id: string;
  site_id?: string;
  name: string;
  scopes: string[];
  rate_limit_per_hour?: number;
}

export interface ApiKeyInfo {
  id: string;
  user_id: string;
  site_id?: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: Date;
  last_used_at?: Date;
  is_active: boolean;
  rate_limit_per_hour: number;
}

/**
 * Generate a secure API key
 */
export const generateApiKey = (): { key: string; prefix: string; hash: string } => {
  // Generate a secure random key (32 bytes = 256 bits)
  const key = crypto.randomBytes(32).toString('hex');
  
  // Create prefix (first 8 characters for display)
  const prefix = key.substring(0, 8);
  
  // Hash the full key for storage
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  
  return { key, prefix, hash };
};

/**
 * Create a new API key
 */
export const createApiKey = async (options: CreateApiKeyOptions): Promise<{ apiKey: ApiKeyInfo; key: string }> => {
  const { user_id, site_id, name, scopes, rate_limit_per_hour = 1000 } = options;
  
  // Validate scopes
  const validScopes = ['search', 'embed', 'admin'];
  const invalidScopes = scopes.filter(scope => !validScopes.includes(scope));
  if (invalidScopes.length > 0) {
    throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}. Valid scopes: ${validScopes.join(', ')}`);
  }
  
  // Generate key
  const { key, prefix, hash } = generateApiKey();
  
  // Create in database
  const apiKey = await prisma.apiKey.create({
    data: {
      user_id,
      site_id,
      name,
      key_prefix: prefix,
      key_hash: hash,
      scopes,
      rate_limit_per_hour,
    },
  });
  
  return {
    apiKey: {
      id: apiKey.id,
      user_id: apiKey.user_id,
      site_id: apiKey.site_id || undefined,
      name: apiKey.name,
      key_prefix: apiKey.key_prefix,
      scopes: apiKey.scopes,
      created_at: apiKey.created_at,
      last_used_at: apiKey.last_used_at || undefined,
      is_active: apiKey.is_active,
      rate_limit_per_hour: apiKey.rate_limit_per_hour,
    },
    key, // Return the actual key only once during creation
  };
};

/**
 * Get user's API keys
 */
export const getUserApiKeys = async (user_id: string): Promise<ApiKeyInfo[]> => {
  const apiKeys = await prisma.apiKey.findMany({
    where: { user_id, is_active: true },
    orderBy: { created_at: 'desc' },
  });
  
  return apiKeys.map((apiKey: NonNullable<PrismaApiKey>) => ({
    id: apiKey.id,
    user_id: apiKey.user_id,
    site_id: apiKey.site_id || undefined,
    name: apiKey.name,
    key_prefix: apiKey.key_prefix,
    scopes: apiKey.scopes,
    created_at: apiKey.created_at,
    last_used_at: apiKey.last_used_at || undefined,
    is_active: apiKey.is_active,
    rate_limit_per_hour: apiKey.rate_limit_per_hour,
  }));
};

/**
 * Deactivate an API key
 */
export const deactivateApiKey = async (keyId: string, user_id: string): Promise<void> => {
  await prisma.apiKey.updateMany({
    where: { id: keyId, user_id },
    data: { is_active: false },
  });
};

/**
 * Update API key scopes
 */
export const updateApiKeyScopes = async (
  keyId: string, 
  user_id: string, 
  scopes: string[]
): Promise<ApiKeyInfo> => {
  // Validate scopes
  const validScopes = ['search', 'embed', 'admin'];
  const invalidScopes = scopes.filter(scope => !validScopes.includes(scope));
  if (invalidScopes.length > 0) {
    throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}. Valid scopes: ${validScopes.join(', ')}`);
  }
  
  const apiKey = await prisma.apiKey.update({
    where: { id: keyId },
    data: { scopes },
  });
  
  // Verify ownership
  if (apiKey.user_id !== user_id) {
    throw new Error('Unauthorized: API key does not belong to user');
  }
  
  return {
    id: apiKey.id,
    user_id: apiKey.user_id,
    site_id: apiKey.site_id || undefined,
    name: apiKey.name,
    key_prefix: apiKey.key_prefix,
    scopes: apiKey.scopes,
    created_at: apiKey.created_at,
    last_used_at: apiKey.last_used_at || undefined,
    is_active: apiKey.is_active,
    rate_limit_per_hour: apiKey.rate_limit_per_hour,
  };
};

/**
 * Get API key usage statistics
 */
export const getApiKeyUsage = async (keyId: string): Promise<{
  total_requests: number;
  requests_last_hour: number;
  requests_last_24h: number;
}> => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Note: This requires implementing usage tracking in the middleware
  // For now, return placeholder data
  return {
    total_requests: 0,
    requests_last_hour: 0,
    requests_last_24h: 0,
  };
}; 