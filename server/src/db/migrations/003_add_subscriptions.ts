/**
 * Database Migration: Add subscriptions table
 */
import { Database } from 'better-sqlite3';

export const name = '003_add_subscriptions';

export function up(db: Database): void {
  // Check if subscriptions table already exists
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='subscriptions'")
    .all() as { name: string }[];
  
  if (tables.length > 0) {
    console.log('  ✓ Subscriptions table already exists');
    return;
  }

  db.exec(`
    CREATE TABLE subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stripe_customer_id TEXT NOT NULL,
      stripe_subscription_id TEXT,
      stripe_price_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      tier TEXT NOT NULL DEFAULT 'hobby',
      current_period_start TEXT,
      current_period_end TEXT,
      cancel_at_period_end INTEGER DEFAULT 0,
      canceled_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
  `);
  
  console.log('  ✓ Created subscriptions table');
}

export function down(db: Database): void {
  db.exec(`
    DROP TABLE IF EXISTS subscriptions;
  `);
  console.log('  ✓ Dropped subscriptions table');
}