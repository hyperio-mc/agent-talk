/**
 * Audio Routes - Serve audio files
 */

import { Hono } from 'hono';
import { getStorage } from '../services/storage.js';
import { NotFoundError, StorageError } from '../errors/index.js';
import { logger } from '../utils/logger.js';

export const audioRoutes = new Hono();

// Audio serving endpoint
audioRoutes.get('/:filename', async (c) => {
  const filename = c.req.param('filename');
  
  // Validate filename format (prevent directory traversal)
  if (!filename.match(/^audio_[a-z0-9_-]+\.(mp3|wav|ogg|webm)$/i)) {
    throw new NotFoundError('Audio file');
  }
  
  try {
    const storage = getStorage();
    const audioFile = await storage.get(filename);
    
    // Set caching headers - audio files are immutable once created
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
    c.header('Content-Type', `audio/${audioFile.format}`);
    c.header('Content-Length', audioFile.size.toString());
    c.header('Accept-Ranges', 'bytes');
    c.header('X-Content-Type-Options', 'nosniff');
    
    // Add CORS headers for cross-origin audio playback
    c.header('Access-Control-Allow-Origin', '*');
    
    logger.debug('Serving audio file', { 
      filename, 
      size: audioFile.size, 
      format: audioFile.format 
    });
    
    return c.body(new Uint8Array(audioFile.data));
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError('Audio file');
    }
    logger.logError('Failed to serve audio', error, { filename });
    throw new StorageError('serve');
  }
});
