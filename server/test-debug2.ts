import { Hono } from 'hono';
import { keysRoutes } from './src/routes/keys.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { UnauthorizedError } from './src/errors/index.js';

console.log('Testing Hono error handling...')

const app = new Hono();

// Set up error handler properly
app.onError(async (err, c) => {
  console.log('Error caught:', err.message);
  const handler = errorHandler();
  return await handler(err, c);
});

// Add a test route that throws an error
app.get('/test-error', async (c) => {
  throw new UnauthorizedError('Test error');
});

app.route('/api/keys', keysRoutes);

// Test 1: Route that throws
console.log('\nTest 1: Route that throws');
const resp1 = await app.request('/test-error', { method: 'GET' });
console.log('Status:', resp1?.status);
if (resp1) {
  try {
    const body = await resp1.json();
    console.log('Body:', body);
  } catch (e) {
    console.log('Failed to parse body:', e.message);
  }
}

// Test 2: Keys route without auth
console.log('\nTest 2: Keys route without auth');
const resp2 = await app.request('/api/keys', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test' }),
});
console.log('Status:', resp2?.status);
if (resp2) {
  try {
    const body = await resp2.json();
    console.log('Body:', body);
  } catch (e) {
    console.log('Failed to parse body:', e.message);
  }
}
