/**
 * Supabase Storage Service
 * Handles file uploads, downloads, and management using Supabase Storage
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import path from 'path';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Storage bucket for plugin files
const PLUGINS_BUCKET = 'plugins';

/**
 * Initialize storage buckets
 */
export const initializeStorage = async (): Promise<void> => {
  try {
    // Check if plugins bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const pluginsBucket = buckets?.find((bucket: any) => bucket.name === PLUGINS_BUCKET);

    if (!pluginsBucket) {
      // Create plugins bucket
      const { error } = await supabase.storage.createBucket(PLUGINS_BUCKET, {
        public: false, // Private bucket for plugin files
        allowedMimeTypes: ['application/zip', 'application/x-zip-compressed'],
        fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
      });

      if (error) {
        console.error('Failed to create plugins bucket:', error);
        throw error;
      }

      console.log(`✅ Created storage bucket: ${PLUGINS_BUCKET}`);
    } else {
      console.log(`✅ Storage bucket ${PLUGINS_BUCKET} already exists`);
    }
  } catch (error) {
    console.error('❌ Failed to initialize storage:', error);
    throw error;
  }
};

/**
 * Generate secure file path for plugin storage
 */
const generateSecureFilePath = (
  originalFilename: string,
  productSlug: string
): string => {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalFilename);
  const baseName = path.basename(originalFilename, extension);

  return `${productSlug}/${baseName}-${timestamp}-${randomSuffix}${extension}`;
};

/**
 * Upload file to Supabase Storage
 */
export const uploadFile = async (
  fileBuffer: Buffer,
  originalFilename: string,
  productSlug: string,
  contentType: string = 'application/zip'
): Promise<{
  filePath: string;
  fileSize: number;
  fileHash: string;
}> => {
  try {
    // Generate secure file path
    const filePath = generateSecureFilePath(originalFilename, productSlug);

    // Generate file hash for integrity
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(PLUGINS_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType,
        duplex: 'half',
      });

    if (error) {
      console.error('Failed to upload file to Supabase Storage:', error);
      throw error;
    }

    console.log(`✅ Uploaded file to: ${data.path}`);

    return {
      filePath: data.path,
      fileSize: fileBuffer.length,
      fileHash,
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Download file from Supabase Storage
 */
export const downloadFile = async (filePath: string): Promise<{
  buffer: Buffer;
  contentType?: string;
}> => {
  try {
    const { data, error } = await supabase.storage
      .from(PLUGINS_BUCKET)
      .download(filePath);

    if (error) {
      console.error('Failed to download file from Supabase Storage:', error);
      throw error;
    }

    if (!data) {
      throw new Error('No file data received');
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      buffer,
      contentType: data.type,
    };
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
};

/**
 * Delete file from Supabase Storage
 */
export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from(PLUGINS_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Failed to delete file from Supabase Storage:', error);
      throw error;
    }

    console.log(`✅ Deleted file: ${filePath}`);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

/**
 * Check if file exists in Supabase Storage
 */
export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.storage
      .from(PLUGINS_BUCKET)
      .list(path.dirname(filePath), {
        search: path.basename(filePath),
      });

    if (error) {
      return false;
    }

    return data?.some((file: any) => file.name === path.basename(filePath)) || false;
  } catch (error) {
    return false;
  }
};

/**
 * Get file info from Supabase Storage
 */
export const getFileInfo = async (filePath: string): Promise<{
  name: string;
  size: number;
  lastModified: Date;
  contentType?: string;
} | null> => {
  try {
    const { data, error } = await supabase.storage
      .from(PLUGINS_BUCKET)
      .list(path.dirname(filePath), {
        search: path.basename(filePath),
      });

    if (error || !data) {
      return null;
    }

    const file = data.find((f: any) => f.name === path.basename(filePath));
    if (!file) {
      return null;
    }

    return {
      name: file.name,
      size: file.metadata?.size || 0,
      lastModified: new Date(file.updated_at || file.created_at),
      contentType: file.metadata?.mimetype,
    };
  } catch (error) {
    console.error('Error getting file info:', error);
    return null;
  }
};

/**
 * Generate signed URL for temporary file access
 */
export const generateSignedUrl = async (
  filePath: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> => {
  try {
    const { data, error } = await supabase.storage
      .from(PLUGINS_BUCKET)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Failed to generate signed URL:', error);
      throw error;
    }

    if (!data?.signedUrl) {
      throw new Error('No signed URL received');
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw error;
  }
}; 