#!/usr/bin/env node
/**
 * Database CLI Tool
 * 
 * Usage:
 *   npx tsx src/db/cli.ts migrate    - Run migrations
 *   npx tsx src/db/cli.ts seed       - Seed development data
 *   npx tsx src/db/cli.ts reset      - Clear seed data
 *   npx tsx src/db/cli.ts health     - Check database health
 */

import { getDb, closeDb, runMigrations, checkHealth } from './index.js';
import { seedDatabase, clearSeedData } from './seed.js';

const command = process.argv[2];

async function main() {
  console.log('📦 Agent Talk Database CLI');
  console.log('');
  
  try {
    switch (command) {
      case 'migrate':
        console.log('Running migrations...');
        runMigrations();
        console.log('✓ Migrations complete');
        break;
        
      case 'seed':
        console.log('Seeding development data...');
        seedDatabase();
        break;
        
      case 'reset':
        console.log('Clearing seed data...');
        clearSeedData();
        break;
        
      case 'health':
        const health = checkHealth();
        console.log('Database Health:', JSON.stringify(health, null, 2));
        break;
        
      case 'tables':
        const db = getDb();
        const tables = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
          .all() as { name: string }[];
        console.log('Tables:');
        tables.forEach(t => console.log(`  - ${t.name}`));
        break;
        
      default:
        console.log('Usage:');
        console.log('  npx tsx src/db/cli.ts migrate    Run pending migrations');
        console.log('  npx tsx src/db/cli.ts seed       Seed development data');
        console.log('  npx tsx src/db/cli.ts reset      Clear seed data');
        console.log('  npx tsx src/db/cli.ts health     Check database health');
        console.log('  npx tsx src/db/cli.ts tables     List all tables');
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();