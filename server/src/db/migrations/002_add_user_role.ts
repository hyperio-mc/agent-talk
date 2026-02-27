/**
 * Database Migration: Add role column to users
 */
import { Database } from 'better-sqlite3';

export const name = '002_add_user_role';

export function up(db: Database): void {
  // Add role column if it doesn't exist
  const tableInfo = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  const hasRole = tableInfo.some(col => col.name === 'role');
  
  if (!hasRole) {
    db.exec(`
      ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin'))
    `);
    console.log('  ✓ Added role column to users table');
  } else {
    console.log('  ✓ Role column already exists');
  }
}

export function down(db: Database): void {
  // SQLite doesn't support DROP COLUMN, so we'd need to recreate the table
  // For now, this is a no-op
  console.log('  ! Down migration not supported for role column (SQLite limitation)');
}
