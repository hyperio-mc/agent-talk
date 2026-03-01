/**
 * Database Module for Railway
 * 
 * SQLite-based storage with persistent volume support.
 * Falls back to in-memory for development.
 * 
 * Environment variables:
 * - DATABASE_PATH: Path to SQLite database file (default: ./data/agent-talk.db)
 * - NODE_ENV=production: Use persistent SQLite
 */

import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import { migrations } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Database path - use env var or default
const DB_PATH = process.env.DATABASE_PATH || join(__dirname, '../../../data/agent-talk.db');
const USE_MEMORY = process.env.NODE_ENV !== 'production' && !process.env.DATABASE_PATH;

let db: Database.Database | null = null;

/**
 * Get or create database connection
 */
export function getDb(): Database.Database {
  if (!db) {
    if (USE_MEMORY) {
      // In-memory for development
      db = new Database(':memory:');
      console.log('[DB] Using in-memory database (development mode)');
    } else {
      // Persistent SQLite for production
      const dataDir = dirname(DB_PATH);
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }
      
      db = new Database(DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      console.log(`[DB] SQLite database connected: ${DB_PATH}`);
    }
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database connection closed');
  }
}

/**
 * Run pending migrations
 */
export function runMigrations(): void {
  const database = getDb();
  
  // Ensure migrations table exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);
  
  // Get applied migrations
  const applied = database
    .prepare('SELECT name FROM migrations')
    .all() as { name: string }[];
  
  const appliedNames = new Set(applied.map(m => m.name));
  
  // Run pending migrations
  for (const migration of migrations) {
    if (appliedNames.has(migration.name)) {
      console.log(`[DB] Migration already applied: ${migration.name}`);
      continue;
    }
    
    const runMigration = database.transaction(() => {
      database.exec(migration.sql);
      database.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
    });
    
    runMigration();
    console.log(`[DB] Migration applied: ${migration.name}`);
  }
}

/**
 * Check database health
 */
export async function checkHealth(): Promise<{
  status: 'ok' | 'error';
  message: string;
  mode: string;
}> {
  try {
    const database = getDb();
    database.prepare('SELECT 1').get();
    return {
      status: 'ok',
      message: USE_MEMORY ? 'In-memory database' : `SQLite at ${DB_PATH}`,
      mode: USE_MEMORY ? 'memory' : 'sqlite',
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      mode: 'error',
    };
  }
}

/**
 * Initialize database (for compatibility with db-stub interface)
 */
export async function initDb(): Promise<void> {
  getDb();
  runMigrations();
}

// Export that we're NOT in HYPR mode (for compatibility)
export const isHyprMode = () => false;
export const isHyprMicroMode = () => false;