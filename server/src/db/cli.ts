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

import { runMigrations, checkHealth, isHyprMode } from './index.js';
import { seedDatabase, clearSeedData } from './seed.js';

const command = process.argv[2];

async function main() {
  console.log('📦 Agent Talk Database CLI');
  console.log('');
  
  try {
    switch (command) {
      case 'migrate':
        console.log('Running migrations...');
        await runMigrations();
        console.log('✓ Migrations complete');
        break;
        
      case 'seed':
        console.log('Seeding development data...');
        await seedDatabase();
        break;
        
      case 'reset':
        console.log('Clearing seed data...');
        await clearSeedData();
        console.log('✓ Seed data cleared');
        break;
        
      case 'health':
        const health = await checkHealth();
        console.log('Database Health:');
        console.log(JSON.stringify(health, null, 2));
        break;
        
      case 'mode':
        console.log('Current mode:', isHyprMode() ? 'HYPR Micro (production)' : 'In-Memory (development)');
        break;
        
      default:
        console.log('Usage:');
        console.log('  npx tsx src/db/cli.ts migrate    Run pending migrations');
        console.log('  npx tsx src/db/cli.ts seed       Seed development data');
        console.log('  npx tsx src/db/cli.ts reset      Clear seed data');
        console.log('  npx tsx src/db/cli.ts health     Check database health');
        console.log('  npx tsx src/db/cli.ts mode       Show current database mode');
        console.log('');
        console.log('Environment:');
        console.log('  HYPR_MODE=production  Use HYPR Micro (default: in-memory)');
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();