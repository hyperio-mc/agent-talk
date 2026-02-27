/**
 * HYPR Micro Client
 * 
 * Client for interacting with HYPR Micro (LMDB-backed database)
 * through the HYPR proxy. Provides type-safe CRUD operations.
 * 
 * @see HYPR-REFACTOR-PLAN.md Phase 3
 */

import { getHyprConfig, getHyprHeaders, HyprConfig } from './hypr-config.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface MicroDocument {
  id: string;
  [key: string]: unknown;
}

// Helper type to make any object compatible with MicroDocument
export type AsMicroDoc<T> = T & Record<string, unknown>;

export interface MicroQueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface MicroWhereClause {
  [field: string]: unknown;
}

export interface MicroListResponse<T> {
  docs: T[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// HYPR Micro Client
// ============================================================================

export class HyprMicroClient {
  private config: HyprConfig;
  private baseUrl: string;

  constructor(config?: HyprConfig) {
    this.config = config || getHyprConfig();
    this.baseUrl = this.config.microUrl;
  }

  /**
   * Create a new database
   */
  async createDatabase(name: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/dbs/${name}`,
      {
        method: 'POST',
        headers: getHyprHeaders(this.config),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create database ${name}: ${error}`);
    }

    logger.debug('Database created', { name });
  }

  /**
   * List all databases
   */
  async listDatabases(): Promise<string[]> {
    const response = await fetch(
      `${this.baseUrl}/api/dbs`,
      {
        headers: getHyprHeaders(this.config),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list databases: ${error}`);
    }

    const data = await response.json();
    return data.databases || [];
  }

  /**
   * Insert a document into a database
   */
  async insert<T extends Record<string, unknown>>(
    dbName: string,
    doc: T
  ): Promise<T> {
    // Ensure doc has an id
    const docWithId = doc as T & { id: string };
    if (!docWithId.id) {
      docWithId.id = this.generateId();
    }

    const response = await fetch(
      `${this.baseUrl}/api/dbs/${dbName}/docs`,
      {
        method: 'POST',
        headers: getHyprHeaders(this.config),
        body: JSON.stringify({
          key: docWithId.id,
          value: docWithId,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to insert document: ${error}`);
    }

    logger.debug('Document inserted', { db: dbName, id: docWithId.id });
    return docWithId;
  }

  /**
   * Get a document by ID
   */
  async get<T extends Record<string, unknown>>(
    dbName: string,
    id: string
  ): Promise<T | null> {
    const response = await fetch(
      `${this.baseUrl}/api/dbs/${dbName}/docs/${id}`,
      {
        headers: getHyprHeaders(this.config),
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get document: ${error}`);
    }

    const data = await response.json();
    return data.value as T;
  }

  /**
   * Update a document
   */
  async update<T extends Record<string, unknown>>(
    dbName: string,
    id: string,
    updates: Partial<T>
  ): Promise<T | null> {
    // First get the existing document
    const existing = await this.get<T>(dbName, id);
    if (!existing) {
      return null;
    }

    const updated = { ...existing, ...updates, id };

    const response = await fetch(
      `${this.baseUrl}/api/dbs/${dbName}/docs/${id}`,
      {
        method: 'PUT',
        headers: getHyprHeaders(this.config),
        body: JSON.stringify({ value: updated }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update document: ${error}`);
    }

    logger.debug('Document updated', { db: dbName, id });
    return updated as T;
  }

  /**
   * Delete a document
   */
  async delete(dbName: string, id: string): Promise<boolean> {
    const response = await fetch(
      `${this.baseUrl}/api/dbs/${dbName}/docs/${id}`,
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
      throw new Error(`Failed to delete document: ${error}`);
    }

    logger.debug('Document deleted', { db: dbName, id });
    return true;
  }

  /**
   * List all documents in a database
   */
  async list<T extends Record<string, unknown>>(
    dbName: string,
    options?: MicroQueryOptions
  ): Promise<MicroListResponse<T>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));

    const response = await fetch(
      `${this.baseUrl}/api/dbs/${dbName}/docs?${params}`,
      {
        headers: getHyprHeaders(this.config),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list documents: ${error}`);
    }

    const data = await response.json();
    
    // Transform docs array
    let docs: T[] = (data.docs || []).map((d: { value: T }) => d.value as T);
    
    // Apply client-side sorting if needed
    if (options?.orderBy) {
      const orderBy = options.orderBy;
      docs = docs.sort((a, b) => {
        const aVal = String(a[orderBy] ?? '');
        const bVal = String(b[orderBy] ?? '');
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return options.orderDirection === 'desc' ? -cmp : cmp;
      });
    }

    return {
      docs,
      total: docs.length,
      hasMore: false, // Micro doesn't support pagination natively
    };
  }

  /**
   * Query documents by field value
   * Note: HYPR Micro doesn't support server-side queries, so we filter client-side
   */
  async query<T extends Record<string, unknown>>(
    dbName: string,
    where: MicroWhereClause,
    options?: MicroQueryOptions
  ): Promise<T[]> {
    const { docs } = await this.list<T>(dbName, options);
    
    // Client-side filtering
    return docs.filter(doc => {
      return Object.entries(where).every(([key, value]) => {
        if (Array.isArray(value)) {
          return value.includes(doc[key]);
        }
        return doc[key] === value;
      });
    });
  }

  /**
   * Count documents matching a query
   */
  async count(
    dbName: string,
    where?: MicroWhereClause
  ): Promise<number> {
    if (!where) {
      const { total } = await this.list(dbName);
      return total;
    }
    
    const docs = await this.query(dbName, where);
    return docs.length;
  }

  /**
   * Generate unique document ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `${timestamp}_${random}`;
  }
}

// Singleton instance
let microClient: HyprMicroClient | null = null;

/**
 * Get the HYPR Micro client instance
 */
export function getMicroClient(): HyprMicroClient {
  if (!microClient) {
    microClient = new HyprMicroClient();
  }
  return microClient;
}

/**
 * Initialize the Micro client with custom config
 */
export function initMicroClient(config?: HyprConfig): HyprMicroClient {
  microClient = new HyprMicroClient(config);
  return microClient;
}

export default HyprMicroClient;