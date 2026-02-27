/**
 * Database Module (HYPR Micro)
 * 
 * Database operations are now handled by HYPR Micro.
 * The module provides a unified interface for both HYPR Micro (production)
 * and in-memory storage (development/fallback).
 * 
 * Set environment variable:
 * - HYPR_MODE=production to use HYPR Micro
 * - HYPR_MODE=development or unset for in-memory storage
 * 
 * @see HYPR-REFACTOR-PLAN.md Phase 3
 */

import { getMicroClient, HyprMicroClient } from '../lib/hypr-micro.js';
import { logger } from '../utils/logger.js';

// Database names in HYPR Micro
export const DB_NAMES = {
  USERS: 'users',
  API_KEYS: 'api_keys',
  MEMOS: 'memos',
  USAGE_LOGS: 'usage_logs',
  SUBSCRIPTIONS: 'subscriptions',
} as const;

// Initialize flag
let isInitialized = false;
let hyprMode = false;

/**
 * Check if we're running in HYPR mode
 */
export function isHyprMode(): boolean {
  return hyprMode;
}

/**
 * Initialize databases
 * In HYPR mode, creates tables in HYPR Micro
 * In development mode, uses in-memory storage
 */
export async function initDatabases(): Promise<void> {
  if (isInitialized) {
    return;
  }

  hyprMode = process.env.HYPR_MODE === 'production' || 
             process.env.NODE_ENV === 'production';

  if (hyprMode) {
    logger.info('Initializing HYPR Micro databases...');
    
    try {
      const client = getMicroClient();
      
      // Create databases if they don't exist
      for (const db of Object.values(DB_NAMES)) {
        try {
          await client.createDatabase(db);
          logger.debug('Database created/verified', { db });
        } catch (error) {
          // Database might already exist, that's fine
          logger.debug('Database already exists or error', { db, error: { name: 'InitError', message: String(error) } });
        }
      }
      
      logger.info('HYPR Micro databases initialized');
    } catch (error) {
      logger.error('Failed to initialize HYPR Micro, falling back to memory', { error: { name: 'InitError', message: String(error) } });
      hyprMode = false;
    }
  } else {
    logger.info('Using in-memory database (development mode)');
  }

  isInitialized = true;
}

/**
 * Get the HYPR Micro client (throws if not in HYPR mode)
 */
export function getMicro(): HyprMicroClient {
  if (!hyprMode) {
    throw new Error('Not in HYPR mode. Use HYPR_MODE=production to enable HYPR Micro.');
  }
  return getMicroClient();
}

/**
 * Legacy compatibility: getDb returns null (no SQLite connection)
 * @deprecated Use HYPR Micro operations directly
 */
export function getDb(): unknown {
  return null;
}

/**
 * Legacy compatibility: closeDb is a no-op
 */
export function closeDb(): void {
  // No-op - HYPR Micro doesn't need cleanup
}

/**
 * Legacy compatibility: runMigrations handles database setup
 */
export async function runMigrations(): Promise<void> {
  await initDatabases();
}

/**
 * Health check for database connection
 */
export async function checkHealth(): Promise<{ status: string; message: string; mode: string }> {
  if (hyprMode) {
    try {
      const client = getMicroClient();
      const dbs = await client.listDatabases();
      return {
        status: 'ok',
        message: `HYPR Micro connected (${dbs.length} databases)`,
        mode: 'hypr',
      };
    } catch (error) {
      return {
        status: 'error',
        message: `HYPR Micro error: ${error}`,
        mode: 'hypr',
      };
    }
  } else {
    return {
      status: 'ok',
      message: 'Using in-memory storage',
      mode: 'memory',
    };
  }
}

// Re-export model functions
export { 
  findUserById, 
  findUserByEmail, 
  createUser, 
  updateUser,
  getAllUsers,
  updateUserTier
} from './users.js';

export {
  createMemo,
  getMemosByUserId,
  getMemoById,
  deleteMemo,
  getAllMemos,
  countMemosByUserId
} from './memos.js';

export {
  createApiKeyRecord,
  getApiKeyByKey,
  getApiKeysByUserId,
  revokeApiKey,
  incrementKeyUsage,
  getAllApiKeys,
  deleteApiKey
} from './keys.js';

export {
  createSubscription,
  getSubscriptionByUserId,
  updateSubscription,
  cancelSubscription,
  getAllSubscriptions
} from './subscriptions.js';

export default {
  initDatabases,
  isHyprMode,
  getMicro,
  getDb,
  closeDb,
  runMigrations,
  checkHealth,
};