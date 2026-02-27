/**
 * Storage Service - Abstract storage interface for audio files
 * 
 * Supports multiple backends:
 * - local: Filesystem storage (development)
 * - s3: Amazon S3 (production) - future
 * - r2: Cloudflare R2 (production) - future
 */

import { randomBytes } from 'crypto';
import { mkdirSync, existsSync, writeFileSync, readFileSync, unlinkSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { StorageError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface StorageConfig {
  backend: 'local' | 's3' | 'r2';
  basePath?: string; // For local storage
  bucket?: string; // For S3/R2
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
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
  const finalConfig: StorageConfig = {
    backend: (process.env.STORAGE_BACKEND as StorageConfig['backend']) || 'local',
    basePath: process.env.STORAGE_PATH || join(__dirname, '../../../data/audio'),
    bucket: process.env.STORAGE_BUCKET,
    region: process.env.STORAGE_REGION,
    endpoint: process.env.STORAGE_ENDPOINT,
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
    ...config,
  };

  if (storageInstance) {
    logger.warn('Storage already initialized, re-initializing with new config');
  }

  storageInstance = new StorageService(finalConfig);
  logger.info('Storage initialized', { backend: finalConfig.backend });
  
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

  constructor(config: StorageConfig) {
    this.config = config;

    if (config.backend === 'local') {
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

    try {
      let size: number;
      
      switch (this.config.backend) {
        case 'local':
          size = await this.uploadLocal(key, data);
          break;
        case 's3':
        case 'r2':
          // Future: Implement S3/R2 upload
          throw new StorageError(`${this.config.backend} storage not implemented`);
        default:
          throw new StorageError(`Unknown storage backend: ${this.config.backend}`);
      }

      const url = this.getUrl(key);

      logger.debug('Audio uploaded', { id, key, size, format });

      return {
        id,
        url,
        key,
        size,
        format,
      };
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
        case 'local':
          const result = this.getLocal(key);
          data = result.data;
          createdAt = result.createdAt;
          size = result.size;
          break;
        case 's3':
        case 'r2':
          throw new StorageError(`${this.config.backend} storage not implemented`);
        default:
          throw new StorageError(`Unknown storage backend: ${this.config.backend}`);
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
        case 'local':
          return this.deleteLocal(key);
        case 's3':
        case 'r2':
          throw new StorageError(`${this.config.backend} storage not implemented`);
        default:
          throw new StorageError(`Unknown storage backend: ${this.config.backend}`);
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
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    return `${baseUrl}/audio/${key}`;
  }

  /**
   * Get file path for local storage
   */
  getLocalPath(key: string): string {
    return join(this.config.basePath!, key);
  }

  // --- Local storage methods ---

  private ensureDirectory(): void {
    if (!existsSync(this.config.basePath!)) {
      mkdirSync(this.config.basePath!, { recursive: true });
      logger.info('Created audio storage directory', { path: this.config.basePath });
    }
  }

  private async uploadLocal(key: string, data: ArrayBuffer | Buffer): Promise<number> {
    const filePath = this.getLocalPath(key);
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    
    writeFileSync(filePath, buffer);
    
    return buffer.length;
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
