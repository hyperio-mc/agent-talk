/**
 * Storage Service - HYPR Storage Implementation
 * 
 * Supports multiple backends:
 * - hypr: HYPR Storage via proxy (production)
 * - micro: HYPR Micro storage API
 * - local: Filesystem storage (development)
 * 
 * @see HYPR-REFACTOR-PLAN.md Phase 4
 */

import { randomBytes } from 'crypto';
import { mkdirSync, existsSync, writeFileSync, readFileSync, unlinkSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getStorageClient, HyprStorageClient } from '../lib/hypr-storage.js';
import { logger } from '../utils/logger.js';
import { StorageError } from '../errors/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface StorageConfig {
  backend: 'hypr' | 'micro' | 'local';
  bucket?: string; // For HYPR storage
  basePath?: string; // For local storage
}

export interface UploadResult {
  id: string;
  url: string;
  key: string;
  size: number;
  format: string;
}

export interface AudioFile {
  id: string;
  data: Buffer;
  format: string;
  size: number;
  createdAt: Date;
}

/**
 * Storage Service - Singleton pattern
 */
let storageInstance: StorageService | null = null;

export function initStorage(config?: Partial<StorageConfig>): StorageService {
  const backend = (process.env.STORAGE_BACKEND as StorageConfig['backend']) || 
    (process.env.HYPR_MODE === 'production' ? 'hypr' : 'local');
  
  const finalConfig: StorageConfig = {
    backend,
    bucket: process.env.STORAGE_BUCKET || 'audio',
    basePath: process.env.STORAGE_PATH || join(__dirname, '../../../data/audio'),
    ...config,
  };

  if (storageInstance) {
    logger.warn('Storage already initialized, re-initializing with new config');
  }

  storageInstance = new StorageService(finalConfig);
  logger.info('Storage initialized', { backend: finalConfig.backend, bucket: finalConfig.bucket });
  
  return storageInstance;
}

export function getStorage(): StorageService {
  if (!storageInstance) {
    return initStorage();
  }
  return storageInstance;
}

export class StorageService {
  private config: StorageConfig;
  private hyprClient: HyprStorageClient | null = null;

  constructor(config: StorageConfig) {
    this.config = config;

    if (config.backend === 'hypr' || config.backend === 'micro') {
      this.hyprClient = getStorageClient();
    } else if (config.backend === 'local') {
      this.ensureDirectory();
    }
  }

  /**
   * Generate unique audio ID
   */
  generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(6).toString('base64url');
    return `audio_${timestamp}_${random}`;
  }

  /**
   * Upload audio file
   */
  async upload(
    data: ArrayBuffer | Buffer,
    format: string = 'mp3'
  ): Promise<UploadResult> {
    const id = this.generateId();
    const key = `${id}.${format}`;
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    try {
      let url: string;
      let size: number = buffer.length;

      switch (this.config.backend) {
        case 'hypr':
        case 'micro':
          url = await this.uploadHypr(key, buffer, format);
          break;
        case 'local':
        default:
          url = await this.uploadLocal(key, buffer);
          break;
      }

      logger.debug('Audio uploaded', { id, key, size, format, backend: this.config.backend });

      return { id, url, key, size, format };
    } catch (error) {
      logger.logError('Failed to upload audio', error, { id });
      throw new StorageError('upload');
    }
  }

  /**
   * Retrieve audio file
   */
  async get(key: string): Promise<AudioFile> {
    try {
      let data: Buffer;
      let createdAt: Date;
      let size: number;

      switch (this.config.backend) {
        case 'hypr':
        case 'micro':
          const hyprResult = await this.getHypr(key);
          data = hyprResult.data;
          createdAt = hyprResult.createdAt;
          size = hyprResult.size;
          break;
        case 'local':
        default:
          const localResult = this.getLocal(key);
          data = localResult.data;
          createdAt = localResult.createdAt;
          size = localResult.size;
          break;
      }

      const format = this.getFormatFromKey(key);

      return {
        id: this.getIdFromKey(key),
        data,
        format,
        size,
        createdAt,
      };
    } catch (error) {
      logger.logError('Failed to retrieve audio', error, { key });
      throw new StorageError('get');
    }
  }

  /**
   * Delete audio file
   */
  async delete(key: string): Promise<boolean> {
    try {
      switch (this.config.backend) {
        case 'hypr':
        case 'micro':
          return await this.deleteHypr(key);
        case 'local':
        default:
          return this.deleteLocal(key);
      }
    } catch (error) {
      logger.logError('Failed to delete audio', error, { key });
      throw new StorageError('delete');
    }
  }

  /**
   * Get public URL for audio file
   */
  getUrl(key: string): string {
    switch (this.config.backend) {
      case 'hypr':
      case 'micro':
        if (this.hyprClient) {
          return this.hyprClient.getUrl(this.config.bucket!, key);
        }
        // Fallback to platform URL
        const platformUrl = process.env.HYPR_PLATFORM_URL || 'https://onhyper.io';
        return `${platformUrl}/storage/${this.config.bucket}/${key}`;
      case 'local':
      default:
        const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
        return `${baseUrl}/audio/${key}`;
    }
  }

  /**
   * Get file path for local storage
   */
  getLocalPath(key: string): string {
    return join(this.config.basePath!, key);
  }

  // --- HYPR Storage methods ---

  private async uploadHypr(key: string, data: Buffer, format: string): Promise<string> {
    if (!this.hyprClient) {
      throw new Error('HYPR storage client not initialized');
    }

    // Ensure bucket exists
    await this.hyprClient.ensureBucket(this.config.bucket!);

    const file = await this.hyprClient.upload({
      bucket: this.config.bucket!,
      filename: key,
      data,
      contentType: `audio/${format}`,
      public: true,
    });

    return file.url;
  }

  private async getHypr(key: string): Promise<{ data: Buffer; createdAt: Date; size: number }> {
    if (!this.hyprClient) {
      throw new Error('HYPR storage client not initialized');
    }

    const data = await this.hyprClient.download(this.config.bucket!, key);
    
    return {
      data,
      createdAt: new Date(), // HYPR doesn't provide creation date
      size: data.length,
    };
  }

  private async deleteHypr(key: string): Promise<boolean> {
    if (!this.hyprClient) {
      throw new Error('HYPR storage client not initialized');
    }

    return this.hyprClient.delete(this.config.bucket!, key);
  }

  // --- Local storage methods ---

  private ensureDirectory(): void {
    if (!existsSync(this.config.basePath!)) {
      mkdirSync(this.config.basePath!, { recursive: true });
      logger.info('Created audio storage directory', { path: this.config.basePath });
    }
  }

  private async uploadLocal(key: string, data: Buffer): Promise<string> {
    const filePath = this.getLocalPath(key);
    writeFileSync(filePath, data);
    return this.getUrl(key);
  }

  private getLocal(key: string): { data: Buffer; createdAt: Date; size: number } {
    const filePath = this.getLocalPath(key);
    
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }

    const stats = statSync(filePath);
    const data = readFileSync(filePath);

    return {
      data,
      createdAt: stats.birthtime,
      size: stats.size,
    };
  }

  private deleteLocal(key: string): boolean {
    const filePath = this.getLocalPath(key);
    
    if (!existsSync(filePath)) {
      return false;
    }

    unlinkSync(filePath);
    return true;
  }

  private getFormatFromKey(key: string): string {
    const parts = key.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : 'mp3';
  }

  private getIdFromKey(key: string): string {
    // Key format: audio_timestamp_random.format
    const parts = key.split('.');
    return parts[0];
  }
}