/**
 * Database Stub Module
 * 
 * Hybrid implementation that uses HYPR Micro when available,
 * with in-memory fallback for development.
 * 
 * @see task-162-phase3-hypr-micro.md
 */

import { getMicroClient, HyprMicroClient } from '../lib/hypr-micro.js';
import { isHyprMode, initMicroTables, TABLES } from '../lib/micro-tables.js';

// Re-export all submodules
export * from './users.js';
export * from './keys.js';
export * from './memos.js';
export * from './usage_logs.js';
export * from './subscriptions.js';

// Export table names and helpers
export { TABLES, isHyprMode, initMicroTables };

/**
 * Check if running in HYPR Micro mode
 * HYPR Micro mode uses the remote database instead of local SQLite
 */
export { isHyprMode as isHyprMicroMode };

/**
 * Get database client (HYPR Micro)
 * Returns null if not in HYPR mode
 */
export function getDb(): HyprMicroClient | null {
  if (isHyprMode()) {
    return getMicroClient();
  }
  return null;
}

/**
 * Initialize database
 * Creates HYPR Micro tables if needed
 */
export async function initDb(): Promise<void> {
  if (isHyprMode()) {
    console.log('[DB] Initializing HYPR Micro tables...');
    await initMicroTables();
    console.log('[DB] HYPR Micro tables initialized');
  } else {
    console.log('[DB] Using in-memory storage (development mode)');
  }
}

/**
 * Run migrations - stub
 * HYPR Micro handles schema differently
 */
export async function runMigrations(): Promise<void> {
  // No-op for HYPR Micro
  // Schema is managed through HYPR Micro's database creation API
}

/**
 * Check database health
 */
export async function checkHealth(): Promise<{ 
  status: 'ok' | 'error'; 
  message: string; 
  mode: string;
}> {
  if (isHyprMode()) {
    try {
      const client = getMicroClient();
      await client.listDatabases();
      return {
        status: 'ok',
        message: 'HYPR Micro connected',
        mode: 'hypr',
      };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        mode: 'hypr',
      };
    }
  }
  
  return {
    status: 'ok',
    message: 'Using in-memory storage (development mode)',
    mode: 'memory',
  };
}

/**
 * Close database connection - stub
 * No-op for HYPR Micro (client handles connection pooling)
 */
export function closeDb(): void {
  // No-op for HYPR Micro
}