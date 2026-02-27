/**
 * Development Seed Data
 * 
 * Creates test users and API keys for development/testing.
 * Works with both HYPR Micro (production) and in-memory storage (development).
 * Only runs when explicitly triggered.
 */

import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import { isHyprMode, DB_NAMES } from './index.js';
import { createUser, findUserByEmail, getAllUsers, User } from './users.js';
import { createApiKeyRecord, getApiKeysByUserId, ApiKey } from './keys.js';
import { getMicroClient } from '../lib/hypr-micro.js';
import { logger } from '../utils/logger.js';

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

// In-memory storage for seed data (development mode)
const memoryUsers = new Map<string, any>();
const memoryApiKeys = new Map<string, any>();

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
 * Hash password with bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Seed development data
 * Creates a test user, admin user, and API keys
 */
export async function seedDatabase(): Promise<SeedResult> {
  const testEmail = 'test@agent-talk.dev';
  const adminEmail = 'admin@agent-talk.dev';
  const testPassword = 'test_password_123';
  const adminPassword = 'admin_password_123';
  
  let adminUser: { id: string; email: string } | undefined;
  let testUser: User;
  let apiKey: ApiKey;
  let testKey: string;
  let testPrefix: string;

  // Check for existing admin user
  const existingAdmin = await findUserByEmail(adminEmail);
  
  if (!existingAdmin) {
    // Create admin user
    const hashedAdminPassword = await hashPassword(adminPassword);
    adminUser = await createUser({ 
      email: adminEmail, 
      passwordHash: hashedAdminPassword,
      tier: 'enterprise'
    });
    
    // Update role to admin
    if (isHyprMode()) {
      await getMicroClient().update(DB_NAMES.USERS, adminUser.id, { role: 'admin' });
    }
    
    logger.info('Created admin user', { email: adminEmail });
  } else {
    adminUser = { id: existingAdmin.id, email: existingAdmin.email };
    // Ensure admin role
    if (isHyprMode()) {
      await getMicroClient().update(DB_NAMES.USERS, existingAdmin.id, { role: 'admin' });
    }
    logger.info('Admin user already exists');
  }

  // Check for existing test user
  const existingUser = await findUserByEmail(testEmail);
  
  if (existingUser) {
    // Check if they have an API key
    const existingKeys = await getApiKeysByUserId(existingUser.id);
    
    if (existingKeys.length > 0) {
      const existingKey = existingKeys[0];
      logger.info('Test user already exists with API key', { 
        userId: existingUser.id, 
        prefix: existingKey.prefix 
      });
      
      return {
        user: { id: existingUser.id, email: existingUser.email },
        adminUser,
        apiKey: {
          id: existingKey.id,
          key: '(already exists - check db)',
          prefix: existingKey.prefix
        }
      };
    }
    
    // User exists but no key - create one
    const keyResult = generateApiKey();
    testKey = keyResult.key;
    testPrefix = keyResult.prefix;
    
    apiKey = await createApiKeyRecord({
      userId: existingUser.id,
      keyHash: hashApiKey(testKey),
      prefix: testPrefix,
      name: 'Test Key'
    });
    
    logger.info('Created new API key for existing test user');
    
    return {
      user: { id: existingUser.id, email: existingUser.email },
      adminUser,
      apiKey: { id: apiKey.id, key: testKey, prefix: testPrefix }
    };
  }
  
  // Create new test user
  const hashedPassword = await hashPassword(testPassword);
  testUser = await createUser({ 
    email: testEmail, 
    passwordHash: hashedPassword,
    tier: 'hobby'
  });
  
  // Generate API key
  const keyResult = generateApiKey();
  testKey = keyResult.key;
  testPrefix = keyResult.prefix;
  
  apiKey = await createApiKeyRecord({
    userId: testUser.id,
    keyHash: hashApiKey(testKey),
    prefix: testPrefix,
    name: 'Test Key'
  });
  
  // Print seed data
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════════╗');
  console.log('  ║           🔑 DEVELOPMENT SEED DATA CREATED               ║');
  console.log('  ╠══════════════════════════════════════════════════════════╣');
  console.log('  ║                                                          ║');
  console.log(`  ║  User ID:    ${testUser.id.padEnd(43)}║`);
  console.log(`  ║  Email:      ${testEmail.padEnd(43)}║`);
  console.log(`  ║  Password:   ${testPassword.padEnd(43)}║`);
  console.log('  ║                                                          ║');
  console.log('  ║  API Key (save this!):                                   ║');
  console.log(`  ║  ${testKey.padEnd(57)}║`);
  console.log('  ║                                                          ║');
  console.log('  ║  Mode: ' + (isHyprMode() ? 'HYPR Micro (production)'.padEnd(48) : 'In-Memory (development)'.padEnd(48)) + '║');
  console.log('  ║                                                          ║');
  console.log('  ╚══════════════════════════════════════════════════════════╝');
  console.log('');
  
  return {
    user: { id: testUser.id, email: testEmail },
    adminUser,
    apiKey: { id: apiKey.id, key: testKey, prefix: testPrefix }
  };
}

/**
 * Clear all seed data (for testing)
 */
export async function clearSeedData(): Promise<void> {
  const testEmail = 'test@agent-talk.dev';
  
  // Find and delete test user
  const testUser = await findUserByEmail(testEmail);
  if (testUser) {
    if (isHyprMode()) {
      await getMicroClient().delete(DB_NAMES.API_KEYS, testUser.id);
      await getMicroClient().delete(DB_NAMES.USERS, testUser.id);
    }
    logger.info('Cleared seed data');
  }
}