/**
 * Agent Talk Database Connection
 * 
 * SQLite database with connection pooling via better-sqlite3.
 * Uses WAL mode for better concurrent read performance.
 */

import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import { migrations } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Database configuration
const DB_PATH = process.env.DATABASE_PATH || join(__dirname, '../../../data/agent-talk.db');

let db: Database.Database | null = null;

/**
 * Get or create database connection
 * Singleton pattern - reuses the same connection
 */
export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dataDir = dirname(DB_PATH);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    
    // Enable WAL mode for better concurrent performance
    db.pragma('journal_mode = WAL');
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    console.log(`📦 Database connected: ${DB_PATH}`);
  }

  return db;
}

/**
 * Close database connection
 * Call on server shutdown
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    console.log('📦 Database connection closed');
  }
}

/**
 * Run pending migrations
 * Idempotent - tracks applied migrations in database
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
      console.log(`  ✓ Migration already applied: ${migration.name}`);
      continue;
    }
    
    // Run migration in a transaction
    const runMigration = database.transaction(() => {
      database.exec(migration.sql);
      database.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
    });
    
    runMigration();
    console.log(`  ✓ Migration applied: ${migration.name}`);
  }
}

/**
 * Check database health
 */
export function checkHealth(): { status: string; path: string; tables: number } {
  try {
    const database = getDb();
    const tables = database
      .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'")
      .get() as { count: number };
    
    return {
      status: 'ok',
      path: DB_PATH,
      tables: tables.count
    };
  } catch (error) {
    return {
      status: 'error',
      path: DB_PATH,
      tables: 0
    };
  }
}

// Re-export types and schema
export * from './schema.js';