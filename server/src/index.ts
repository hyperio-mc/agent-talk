import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { MemoService } from './services/memo.js';

// Types for environment bindings
interface Env {
  ELEVENLABS_API_KEY?: string;
  TTS_MODE?: 'simulation' | 'edge' | 'elevenlabs';
  BASE_URL?: string;
}

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use('*', cors());

// Initialize service (will be created per-request in serverless)
function getTTSMode(c: any): 'simulation' | 'edge' | 'elevenlabs' {
  return c.env?.TTS_MODE || 'simulation';
}

function getApiKey(c: any): string | undefined {
  return c.env?.ELEVENLABS_API_KEY;
}

function getBaseUrl(c: any): string {
  return c.env?.BASE_URL || 'https://talk.onhyper.io';
}

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'Agent Talk API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ttsMode: getTTSMode(c)
  });
});

// List available voices
app.get('/api/v1/voices', (c) => {
  const service = new MemoService(getTTSMode(c), getApiKey(c));
  return c.json({
    voices: service.getAvailableVoices()
  });
});

// Create memo (text to speech)
app.post('/api/v1/memo', async (c) => {
  try {
    const body = await c.req.json();
    const { text, voice } = body;

    // Validate input
    if (!text || typeof text !== 'string') {
      return c.json({ error: 'Invalid input: text is required' }, 400);
    }

    if (!voice || typeof voice !== 'string') {
      return c.json({ error: 'Invalid input: voice is required' }, 400);
    }

    const service = new MemoService(getTTSMode(c), getApiKey(c));

    // Validate voice
    if (!service.isValidVoice(voice)) {
      return c.json({
        error: 'Invalid voice',
        requestedVoice: voice,
        availableVoices: service.getAvailableVoices()
      }, 400);
    }

    // Generate memo
    const memo = await service.createMemo(text, voice, getBaseUrl(c));

    return c.json(memo, 201);
  } catch (error) {
    console.error('Error creating memo:', error);
    return c.json({
      error: 'Failed to create memo',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get memo by ID
app.get('/api/v1/memo/:id', async (c) => {
  const id = c.req.param('id');
  
  // In stateless mode, we can't retrieve memos
  // Audio files should be served from cache/storage
  return c.json({
    error: 'Memo retrieval requires storage backend',
    hint: 'Use the audio URL from the memo creation response'
  }, 501);
});

// List memos
app.get('/api/v1/memos', (c) => {
  return c.json({
    error: 'Memo listing requires storage backend',
    hint: 'Store memo IDs client-side for reference'
  }, 501);
});

// Serve audio files (placeholder - needs storage backend)
app.get('/audio/:filename', async (c) => {
  const filename = c.req.param('filename');
  
  // In production, this would serve from object storage
  // For now, return a placeholder
  return c.json({
    error: 'Audio file not found or expired',
    filename
  }, 404);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message
  }, 500);
});

export default app;

// Start server if running directly (Node.js)
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const { serve } = await import('@hono/node-server');
  const port = parseInt(process.env.PORT || '3001');
  
  serve({
    fetch: app.fetch,
    port
  });
  
  console.log(`🎙️  Agent Talk API running on http://localhost:${port}`);
}