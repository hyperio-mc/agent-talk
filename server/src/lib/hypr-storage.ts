/**
 * HYPR Storage Client
 * 
 * Client for uploading and managing files in HYPR storage.
 * Replaces local filesystem storage for audio files.
 * 
 * @see HYPR-REFACTOR-PLAN.md Phase 4
 */

import { getHyprConfig, getHyprHeaders, HyprConfig } from './hypr-config.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface StorageUploadOptions {
  bucket: string;
  filename: string;
  data: Buffer | ArrayBuffer | Uint8Array;
  contentType?: string;
  public?: boolean;
}

export interface StorageFile {
  id: string;
  key: string;
  bucket: string;
  size: number;
  contentType: string;
  url: string;
  createdAt?: string;
}

export interface StorageListOptions {
  prefix?: string;
  limit?: number;
}

// ============================================================================
// HYPR Storage Client
// ============================================================================

export class HyprStorageClient {
  private config: HyprConfig;
  private baseUrl: string;

  constructor(config?: HyprConfig) {
    this.config = config || getHyprConfig();
    // Use HYPR Micro storage API through proxy
    this.baseUrl = `${this.config.microUrl}/api/storage`;
  }

  /**
   * Create a storage bucket
   */
  async createBucket(bucket: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/${bucket}`,
      {
        method: 'POST',
        headers: getHyprHeaders(this.config),
      }
    );

    if (!response.ok && response.status !== 409) {
      // 409 = already exists
      const error = await response.text();
      throw new Error(`Failed to create bucket: ${error}`);
    }

    logger.debug('Bucket ready', { bucket });
  }

  /**
   * List all buckets
   */
  async listBuckets(): Promise<string[]> {
    const response = await fetch(
      this.baseUrl,
      {
        headers: getHyprHeaders(this.config),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list buckets: ${error}`);
    }

    const data = await response.json();
    return data.buckets || [];
  }

  /**
   * Upload a file to storage
   */
  async upload(options: StorageUploadOptions): Promise<StorageFile> {
    const { bucket, filename, data, contentType, public: isPublic = true } = options;

    // Convert data to Uint8Array for Blob compatibility
    let uint8Array: Uint8Array;
    if (data instanceof ArrayBuffer) {
      uint8Array = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      uint8Array = data;
    } else {
      // Buffer or Uint8Array - convert to Uint8Array
      const buf = data as Buffer;
      uint8Array = new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    }

    // Create form data
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(uint8Array)], { 
      type: contentType || 'application/octet-stream' 
    });
    formData.append('file', blob, filename);

    const response = await fetch(
      `${this.baseUrl}/${bucket}/${filename}`,
      {
        method: 'PUT',
        headers: {
          // Don't set Content-Type, let fetch set it with boundary
          'X-App-Slug': this.config.appSlug,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload file: ${error}`);
    }

    const result = await response.json();
    const file: StorageFile = {
      id: result.key || filename,
      key: result.key || filename,
      bucket,
      size: uint8Array.byteLength,
      contentType: contentType || 'application/octet-stream',
      url: this.getUrl(bucket, filename),
      createdAt: new Date().toISOString(),
    };

    logger.info('File uploaded to HYPR storage', { 
      bucket, 
      key: file.key, 
      size: file.size 
    });

    return file;
  }

  /**
   * Download a file from storage
   */
  async download(bucket: string, key: string): Promise<Buffer> {
    const response = await fetch(
      `${this.baseUrl}/${bucket}/${key}`,
      {
        headers: getHyprHeaders(this.config),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to download file: ${error}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Delete a file from storage
   */
  async delete(bucket: string, key: string): Promise<boolean> {
    const response = await fetch(
      `${this.baseUrl}/${bucket}/${key}`,
      {
        method: 'DELETE',
        headers: getHyprHeaders(this.config),
      }
    );

    if (response.status === 404) {
      return false;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete file: ${error}`);
    }

    logger.debug('File deleted from HYPR storage', { bucket, key });
    return true;
  }

  /**
   * List files in a bucket
   */
  async list(
    bucket: string, 
    options?: StorageListOptions
  ): Promise<StorageFile[]> {
    const params = new URLSearchParams();
    if (options?.prefix) params.set('prefix', options.prefix);
    if (options?.limit) params.set('limit', String(options.limit));

    const response = await fetch(
      `${this.baseUrl}/${bucket}?${params}`,
      {
        headers: getHyprHeaders(this.config),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list files: ${error}`);
    }

    const data = await response.json();
    
    return (data.files || []).map((f: any) => ({
      id: f.key,
      key: f.key,
      bucket,
      size: f.size || 0,
      contentType: f.contentType || 'application/octet-stream',
      url: this.getUrl(bucket, f.key),
      createdAt: f.createdAt,
    }));
  }

  /**
   * Get public URL for a file
   */
  getUrl(bucket: string, key: string): string {
    // Use HYPR platform URL for public access
    return `${this.config.platformUrl}/storage/${bucket}/${key}`;
  }

  /**
   * Check if a bucket exists
   */
  async bucketExists(bucket: string): Promise<boolean> {
    const buckets = await this.listBuckets();
    return buckets.includes(bucket);
  }

  /**
   * Ensure a bucket exists, create if not
   */
  async ensureBucket(bucket: string): Promise<void> {
    if (!(await this.bucketExists(bucket))) {
      await this.createBucket(bucket);
    }
  }
}

// Singleton instance
let storageClient: HyprStorageClient | null = null;

/**
 * Get the HYPR Storage client instance
 */
export function getStorageClient(): HyprStorageClient {
  if (!storageClient) {
    storageClient = new HyprStorageClient();
  }
  return storageClient;
}

/**
 * Initialize the Storage client with custom config
 */
export function initStorageClient(config?: HyprConfig): HyprStorageClient {
  storageClient = new HyprStorageClient(config);
  return storageClient;
}

export default HyprStorageClient;