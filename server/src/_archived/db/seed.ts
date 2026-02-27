/**
 * Development Seed Data
 * 
 * Creates test users and API keys for development/testing.
 * Only runs in development environment or when explicitly triggered.
 */

import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import { getDb } from './index.js';

interface SeedResult {
  user: {
    id: string;
    email: string;
  };
  adminUser?: {
    id: string;
    email: string;
  };
  apiKey: {
    id: string;
    key: string; // Only shown once!
    prefix: string;
  };
}

/**
 * Generate a unique ID
 */
function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString('hex');
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Hash an API key for storage
 */
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a new API key
 * Format: at_live_<random 32 chars>
 */
function generateApiKey(): { key: string; prefix: string } {
  const random = randomBytes(24).toString('base64url');
  const key = `at_live_${random}`;
  const prefix = key.substring(0, 15) + '...' + key.substring(key.length - 4);
  return { key, prefix };
}

/**
 * Hash password with bcrypt (async wrapper for seed)
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Seed development data
 * Creates a test user, admin user, and API keys
 */
export async function seedDatabase(): Promise<SeedResult> {
  const db = getDb();
  
  const testEmail = 'test@agent-talk.dev';
  const adminEmail = 'admin@agent-talk.dev';
  const testPassword = 'test_password_123';
  const adminPassword = 'admin_password_123';
  
  let adminUserId: string | undefined;
  
  // Create admin user first
  const existingAdmin = db
    .prepare('SELECT id, email FROM users WHERE email = ?')
    .get(adminEmail) as { id: string; email: string } | undefined;
  
  if (!existingAdmin) {
    adminUserId = generateId('admin');
    const adminPasswordHash = await hashPassword(adminPassword);
    db.prepare(`
      INSERT INTO users (id, email, password_hash, tier, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(adminUserId, adminEmail, adminPasswordHash, 'enterprise', 'admin');
    console.log('  ✓ Created admin user');
    console.log(`  Admin Email: ${adminEmail}`);
    console.log(`  Admin Password: ${adminPassword}`);
  } else {
    adminUserId = existingAdmin.id;
    // Ensure admin role is set
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', existingAdmin.id);
    console.log('  ✓ Admin user already exists');
  }
  
  // Check if test user already exists
  const existingUser = db
    .prepare('SELECT id, email FROM users WHERE email = ?')
    .get(testEmail) as { id: string; email: string } | undefined;
  
  if (existingUser) {
    // Check if they have an API key
    const existingKey = db
      .prepare('SELECT id, prefix FROM api_keys WHERE user_id = ? AND is_active = 1')
      .get(existingUser.id) as { id: string; prefix: string } | undefined;
    
    if (existingKey) {
      console.log('  ⚠️  Test user already exists with API key');
      console.log(`  User ID: ${existingUser.id}`);
      console.log(`  Email: ${existingUser.email}`);
      console.log(`  API Key Prefix: ${existingKey.prefix}`);
      
      return {
        user: existingUser,
        adminUser: adminUserId ? { id: adminUserId, email: adminEmail } : undefined,
        apiKey: {
          id: existingKey.id,
          key: '(already exists - check db)',
          prefix: existingKey.prefix
        }
      };
    }
    
    // User exists but no key - create one
    const { key, prefix } = generateApiKey();
    const keyId = generateId('key');
    
    db.prepare(`
      INSERT INTO api_keys (id, user_id, key_hash, prefix, name)
      VALUES (?, ?, ?, ?, ?)
    `).run(keyId, existingUser.id, hashApiKey(key), prefix, 'Test Key');
    
    console.log('  ✓ Created new API key for existing test user');
    console.log(`  API Key: ${key}`);
    
    return {
      user: existingUser,
      apiKey: { id: keyId, key, prefix }
    };
  }
  
  // Create new test user with bcrypt hashed password
  const userId = generateId('user');
  const { key, prefix } = generateApiKey();
  const keyId = generateId('key');
  const passwordHash = await hashPassword(testPassword);
  
  // Use transaction for atomic insert
  const createTestUser = db.transaction(() => {
    // Insert user
    db.prepare(`
      INSERT INTO users (id, email, password_hash, tier)
      VALUES (?, ?, ?, ?)
    `).run(userId, testEmail, passwordHash, 'hobby');
    
    // Insert API key
    db.prepare(`
      INSERT INTO api_keys (id, user_id, key_hash, prefix, name)
      VALUES (?, ?, ?, ?, ?)
    `).run(keyId, userId, hashApiKey(key), prefix, 'Test Key');
  });
  
  createTestUser();
  
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════════╗');
  console.log('  ║           🔑 DEVELOPMENT SEED DATA CREATED               ║');
  console.log('  ╠══════════════════════════════════════════════════════════╣');
  console.log('  ║                                                          ║');
  console.log(`  ║  User ID:    ${userId.padEnd(43)}║`);
  console.log(`  ║  Email:      ${testEmail.padEnd(43)}║`);
  console.log(`  ║  Password:   ${testPassword.padEnd(43)}║`);
  console.log('  ║                                                          ║');
  console.log('  ║  API Key (save this!):                                   ║');
  console.log(`  ║  ${key.padEnd(57)}║`);
  console.log('  ║                                                          ║');
  console.log('  ╚══════════════════════════════════════════════════════════╝');
  console.log('');
  
  return {
    user: { id: userId, email: testEmail },
    apiKey: { id: keyId, key, prefix }
  };
}

/**
 * Clear all seed data (for testing)
 */
export function clearSeedData(): void {
  const db = getDb();
  const testEmail = 'test@agent-talk.dev';
  
  db.prepare('DELETE FROM api_keys WHERE user_id IN (SELECT id FROM users WHERE email = ?)').run(testEmail);
  db.prepare('DELETE FROM users WHERE email = ?').run(testEmail);
  
  console.log('  ✓ Cleared seed data');
}