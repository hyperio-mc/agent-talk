// Load environment variables from .env file (for Node.js development)
import 'dotenv/config';

import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { MemoService } from './services/memo.js';
import { initStorage } from './services/storage.js';
import { authRoutes } from './routes/auth.js';
import { adminRoutes } from './routes/admin.js';
import { keysRoutes } from './routes/keys.js';
import { audioRoutes } from './routes/audio.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { analyticsRoutes } from './routes/analytics.js';
import { billingRoutes } from './routes/billing.js';
import { webhookRoutes } from './routes/webhooks.js';
import { healthRoutes } from './routes/health.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { 
  securityHeaders, 
  corsMiddleware, 
  DEFAULT_CORS_CONFIG 
} from './middleware/security.js';
import { logger } from './utils/logger.js';
import {
  ValidationError,
  InvalidInputError,
  MissingFieldError,
  InvalidVoiceError,
  NotImplementedError,
  TTSServiceError,
  InvalidApiKeyError,
  MissingApiKeyError
} from './errors/index.js';
import { getDb, closeDb, runMigrations, checkHealth } from './db/index.js';
import {
  extractApiKey,
  validateApiKey,
  recordKeyUsage,
  isApiKeyFormat
} from './services/apiKey.js';
import { simpleRateLimit } from './middleware/rateLimit.js';
import { findUserById } from './db/users.js';
import { createMemo } from './db/memos.js';
import { isCharacterCountAllowed, getTierCharLimit } from './config/tiers.js';
import {
  logMemoCreated,
  logMemoFailed,
  logKeyCreated,
} from './services/analytics.js';

// Types for environment bindings
interface Env {
  ELEVENLABS_API_KEY?: string;
  TTS_MODE?: 'simulation' | 'edge' | 'elevenlabs';
  BASE_URL?: string;
  DATABASE_URL?: string;
  DATABASE_PATH?: string;
  SEED_ON_START?: string;
}

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Request logging middleware (first, to capture all requests)
app.use('*', requestLogger({
  skipPaths: ['/health', '/favicon.ico']
}));

// Security headers middleware (CSP, XSS Protection, Frame Options, etc.)
app.use('*', securityHeaders({
  csp: true,
  xssProtection: true,
  contentTypeOptions: true,
  frameOptions: 'DENY',
  hsts: process.env.NODE_ENV === 'production',
  referrerPolicy: true,
  permissionsPolicy: true,
  hidePoweredBy: true,
}));

// CORS middleware with origin validation
app.use('*', corsMiddleware(DEFAULT_CORS_CONFIG));

// Global error handler (will catch errors from routes)
app.onError(errorHandler({
  includeStackTrace: process.env.NODE_ENV !== 'production',
  logErrors: true
}));

// Initialize service (will be created per-request in serverless)
function getTTSMode(c: any): 'simulation' | 'edge' | 'elevenlabs' {
  // Support both Node.js (process.env) and Cloudflare Workers (c.env)
  return c.env?.TTS_MODE || process.env.TTS_MODE || 'simulation';
}

function getApiKey(c: any): string | undefined {
  // Support both Node.js (process.env) and Cloudflare Workers (c.env)
  return c.env?.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
}

function getBaseUrl(c: any): string {
  // Support both Node.js (process.env) and Cloudflare Workers (c.env)
  return c.env?.BASE_URL || process.env.BASE_URL || 'https://talk.onhyper.io';
}

// Auth routes
app.route('/api/v1/auth', authRoutes);

// Admin routes
app.route('/api/v1/admin', adminRoutes);

// API key management routes (require session auth, not API key)
app.route('/api/keys', keysRoutes);

// Dashboard routes (require session auth)
app.route('/api/v1/dashboard', dashboardRoutes);

// Analytics routes (require session auth)
app.route('/api/v1/analytics', analyticsRoutes);

// Billing routes (tier info, upgrades)
app.route('/api/v1/billing', billingRoutes);

// Stripe webhook routes (no auth required)
app.route('/api/webhooks', webhookRoutes);

// Audio file serving routes
app.route('/audio', audioRoutes);

// Health check routes
app.route('/health', healthRoutes);

// Metrics endpoint for monitoring
app.get('/api/v1/metrics', async (c) => {
  const { getMetricsSummary } = await import('./services/monitoring.js');
  const metrics = getMetricsSummary();
  return c.json(metrics);
});

// List available voices
app.get('/api/v1/voices', (c) => {
  const service = new MemoService(getTTSMode(c), getApiKey(c));
  return c.json({
    voices: service.getAvailableVoices()
  });
});

// Public demo endpoint (no API key required - uses simulation mode)
// Demo has a smaller character limit for abuse prevention
const DEMO_MAX_CHARS = 1000;

app.post('/api/v1/demo', async (c) => {
  // Parse and validate request body
  let body: { text?: unknown; voice?: unknown };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  const { text, voice } = body;

  // Validate text field
  if (text === undefined || text === null || text === '') {
    throw new MissingFieldError('text');
  }
  if (typeof text !== 'string') {
    throw new InvalidInputError('text', 'expected string', text);
  }

  // Check character limit for demo endpoint
  if (text.length > DEMO_MAX_CHARS) {
    throw new ValidationError(
      `Character limit exceeded. Demo allows up to ${DEMO_MAX_CHARS} characters per request.`,
      {
        field: 'text',
        limit: DEMO_MAX_CHARS,
        provided: text.length,
      }
    );
  }

  // Validate voice field
  if (voice === undefined || voice === null || voice === '') {
    throw new MissingFieldError('voice');
  }
  if (typeof voice !== 'string') {
    throw new InvalidInputError('voice', 'expected string', voice);
  }

  // Always use simulation mode for demo
  const service = new MemoService('simulation', undefined);

  // Validate voice exists
  if (!service.isValidVoice(voice)) {
    throw new InvalidVoiceError(voice, service.getAvailableVoices().map(v => v.id));
  }

  // Generate memo (simulation mode)
  const memo = await service.createMemo(text, voice, getBaseUrl(c));

  return c.json(memo, 201);
});

// Create memo (text to speech)
// Requires API key authentication
app.post('/api/v1/memo', async (c) => {
  // API Key Authentication
  const authHeader = c.req.header('Authorization');
  const apiKey = extractApiKey(authHeader);
  
  if (!apiKey) {
    throw new MissingApiKeyError();
  }
  
  // Validate API key (throws InvalidApiKeyError or RevokedKeyError)
  let keyInfo: { keyId: string; userId: string };
  try {
    keyInfo = await validateApiKey(apiKey);
  } catch (error: unknown) {
    // Re-throw AppErrors as-is
    if (error instanceof InvalidApiKeyError) {
      throw error;
    }
    // Check for RevokedKeyError by constructor name
    if (error && typeof error === 'object' && 'constructor' in error && error.constructor.name === 'RevokedKeyError') {
      throw error;
    }
    throw new InvalidApiKeyError();
  }
  
  // Check rate limit before processing
  await simpleRateLimit(c, keyInfo.keyId, keyInfo.userId);
  
  // Parse and validate request body
  let body: { text?: unknown; voice?: unknown };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  const { text, voice } = body;

  // Validate text field
  if (text === undefined || text === null || text === '') {
    throw new MissingFieldError('text');
  }
  if (typeof text !== 'string') {
    throw new InvalidInputError('text', 'expected string', text);
  }

  // Get user's tier for character limit check
  const user = await findUserById(keyInfo.userId);
  const userTier = user?.tier || 'hobby';
  
  // Check character limit based on tier
  const charLimit = getTierCharLimit(userTier as 'hobby' | 'pro' | 'enterprise');
  if (charLimit !== null && text.length > charLimit) {
    throw new ValidationError(
      `Character limit exceeded. Your tier allows up to ${charLimit} characters per memo.`,
      {
        field: 'text',
        limit: charLimit,
        provided: text.length,
        tier: userTier,
      }
    );
  }

  // Validate voice field
  if (voice === undefined || voice === null || voice === '') {
    throw new MissingFieldError('voice');
  }
  if (typeof voice !== 'string') {
    throw new InvalidInputError('voice', 'expected string', voice);
  }

  const service = new MemoService(getTTSMode(c), getApiKey(c));

  // Validate voice exists
  if (!service.isValidVoice(voice)) {
    throw new InvalidVoiceError(voice, service.getAvailableVoices().map(v => v.id));
  }

  // Generate memo
  let memo;
  try {
    memo = await service.createMemo(text, voice, getBaseUrl(c));
  } catch (error) {
    // Log TTS failure
    logMemoFailed(keyInfo.userId, keyInfo.keyId, {
      error: error instanceof Error ? error.message : 'Unknown error',
      voice,
      textLength: text.length,
    });
    throw error;
  }

  // Store memo in database
  const memoRecord = await createMemo({
    userId: keyInfo.userId,
    audioUrl: memo.audio.url,
    durationSec: memo.audio.duration,
    title: undefined,
  });

  // Record API key usage (increment usage count)
  await recordKeyUsage(keyInfo.keyId);

  // Log analytics event
  logMemoCreated(keyInfo.userId, keyInfo.keyId, {
    voice: memo.voice.id,
    characterCount: text.length,
    duration: memo.audio.duration,
  });

  return c.json({
    ...memo,
    id: memoRecord.id,
  }, 201);
});

// Get memo by ID
app.get('/api/v1/memo/:id', async (c) => {
  // In stateless mode, we can't retrieve memos
  // Audio files should be served from cache/storage
  throw new NotImplementedError('Memo retrieval');
});

// List memos
app.get('/api/v1/memos', () => {
  throw new NotImplementedError('Memo listing');
});

// Serve static files (frontend)
// First try to serve static files from public directory
app.use('/*', serveStatic({ root: './public' }));

// SPA fallback - serve index.html for non-API routes
app.get('*', async (c) => {
  const path = c.req.path;
  
  // Skip API and audio routes
  if (path.startsWith('/api/') || path.startsWith('/audio/') || path.startsWith('/health')) {
    return c.notFound();
  }
  
  // For SPA routes, serve index.html
  try {
    const fs = await import('fs');
    const pathModule = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = pathModule.dirname(fileURLToPath(import.meta.url));
    const indexPath = pathModule.join(__dirname, '../public/index.html');
    
    if (fs.existsSync(indexPath)) {
      const indexContent = fs.readFileSync(indexPath, 'utf-8');
      return c.html(indexContent);
    }
  } catch (error) {
    logger.logError('Failed to serve SPA fallback', error);
  }
  
  // If no index.html, return 404
  return c.notFound();
});

// 404 handler for unmatched routes
app.notFound(notFoundHandler);

export default app;

// Start server if running directly (Node.js)
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const { serve } = await import('@hono/node-server');
  const port = parseInt(process.env.PORT || '3001');
  
  // Initialize database (async for HYPR Micro)
  logger.info('Initializing database...');
  await runMigrations();
  
  // Initialize storage
  logger.info('Initializing storage...');
  initStorage();
  
  // Check database health
  const health = await checkHealth();
  logger.info(`Database ready: ${health.message} (${health.mode})`);
  
  // Seed development data if enabled
  if (process.env.SEED_ON_START === 'true') {
    const { seedDatabase } = await import('./db/seed.js');
    logger.info('Seeding development data...');
    await seedDatabase();
  }
  
  serve({
    fetch: app.fetch,
    port
  });
  
  logger.info(`🎙️  Agent Talk API running on http://localhost:${port}`);
  logger.info(`Mode: ${process.env.HYPR_MODE === 'production' ? 'HYPR Production' : 'Development'}`);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    closeDb();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    closeDb();
    process.exit(0);
  });
}