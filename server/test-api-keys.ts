/**
 * Test script for API Key functionality
 */

import { 
  generateApiKey, 
  hashApiKey, 
  maskApiKey, 
  createNewApiKey,
  validateApiKey,
  extractApiKey,
  isApiKeyFormat
} from './src/services/apiKey.js';
import { 
  createApiKey, 
  findApiKeyByHash, 
  listApiKeysByUser,
  clearAllApiKeys 
} from './src/db/keys.js';
import { getDb, runMigrations } from './src/db/index.js';
import { v4 as uuidv4 } from 'uuid';

console.log('🧪 Testing API Key System\n');

// Initialize database
runMigrations();

// Test 1: Key Generation
console.log('1. Testing key generation...');
const liveKey = generateApiKey(false);
const testKey = generateApiKey(true);

console.log('   Live key format:', liveKey.fullKey.startsWith('at_live_') ? '✓' : '✗');
console.log('   Test key format:', testKey.fullKey.startsWith('at_test_') ? '✓' : '✗');
console.log('   Live key:', liveKey.fullKey);
console.log('   Test key:', testKey.fullKey);

// Test 2: Key Hashing
console.log('\n2. Testing key hashing...');
const hash = hashApiKey(liveKey.fullKey);
console.log('   Hash length:', hash.length === 64 ? '✓' : '✗', `(${hash.length} chars)`);
console.log('   Hash (first 20 chars):', hash.slice(0, 20) + '...');

// Test 3: Key Masking
console.log('\n3. Testing key masking...');
const masked = maskApiKey(liveKey.fullKey);
console.log('   Masked key:', masked);
console.log('   Contains asterisks:', masked.includes('***') ? '✓' : '✗');

// Test 4: Database Operations
console.log('\n4. Testing database operations...');
clearAllApiKeys();

const testUserId = uuidv4();
const createdKey = createApiKey({
  userId: testUserId,
  keyHash: hashApiKey(liveKey.fullKey),
  prefix: liveKey.prefix,
  name: 'Test Key 1'
});

console.log('   Created key ID:', createdKey.id);
console.log('   Key has user_id:', createdKey.user_id === testUserId ? '✓' : '✗');
console.log('   Key has prefix:', createdKey.prefix === 'at_live_' ? '✓' : '✗');
console.log('   Key is active:', createdKey.is_active ? '✓' : '✗');

// Test 5: Find by Hash
console.log('\n5. Testing find by hash...');
const foundKey = findApiKeyByHash(hashApiKey(liveKey.fullKey));
console.log('   Found key:', foundKey ? '✓' : '✗');
console.log('   Correct key:', foundKey?.id === createdKey.id ? '✓' : '✗');

// Test 6: List Keys by User
console.log('\n6. Testing list keys by user...');
const userKeys = listApiKeysByUser(testUserId);
console.log('   Keys found:', userKeys.length === 1 ? '✓' : '✗', `(${userKeys.length})`);

// Test 7: Key Validation
console.log('\n7. Testing key validation...');
try {
  const valid = validateApiKey(liveKey.fullKey);
  console.log('   Valid key:', valid.keyId === createdKey.id ? '✓' : '✗');
  console.log('   User ID:', valid.userId === testUserId ? '✓' : '✗');
} catch (e) {
  console.log('   ✗ Validation failed:', e);
}

// Test 8: Invalid Key
console.log('\n8. Testing invalid key...');
try {
  validateApiKey('at_live_invalidkey123');
  console.log('   ✗ Should have thrown error');
} catch (e) {
  console.log('   Throws error for invalid key: ✓');
}

// Test 9: Extract API Key from Header
console.log('\n9. Testing header extraction...');
const extracted = extractApiKey('Bearer ' + liveKey.fullKey);
console.log('   Extracted from Bearer:', extracted === liveKey.fullKey ? '✓' : '✗');

const extracted2 = extractApiKey(liveKey.fullKey);
console.log('   Extracted from plain:', extracted2 === liveKey.fullKey ? '✓' : '✗');

const extracted3 = extractApiKey('Bearer some.jwt.token');
console.log('   Ignores JWT token:', extracted3 === null ? '✓' : '✗');

// Test 10: Key Format Detection
console.log('\n10. Testing format detection...');
console.log('   Live key detected:', isApiKeyFormat(liveKey.fullKey) ? '✓' : '✗');
console.log('   Test key detected:', isApiKeyFormat(testKey.fullKey) ? '✓' : '✗');
console.log('   JWT rejected:', isApiKeyFormat('eyJhbGciOiJIUzI1NiJ9.xxx') ? '✗' : '✓');

// Cleanup
clearAllApiKeys();

console.log('\n✅ All tests completed!');

// Close database
const db = getDb();
db.close();
