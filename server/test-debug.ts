import { Hono } from 'hono';
import { keysRoutes } from './src/routes/keys.js';
import { errorHandler } from './src/middleware/errorHandler.js';

const app = new Hono();
app.onError(errorHandler);
app.route('/api/keys', keysRoutes);

// Simple test
const response = await app.request('/api/keys', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test' }),
});

console.log('Response status:', response.status);
console.log('Response body:', await response.json());
