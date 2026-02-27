/**
 * Static Routes - Serve frontend files
 */

import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { logger } from '../utils/logger.js';

export const staticRoutes = new Hono();

// Serve static files from the public directory
// This serves the built Svelte frontend
staticRoutes.use('/*', serveStatic({
  root: './public',
  onNotFound: (path, c) => {
    logger.debug('Static file not found', { path });
  }
}));

// Serve index.html for SPA fallback (for client-side routing)
staticRoutes.get('*', async (c) => {
  // For API routes, let the 404 handler deal with it
  if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/audio/')) {
    return c.notFound();
  }
  
  // For SPA routes, serve index.html
  try {
    return c.html(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Talk - Text-to-Speech API for AI Agents</title>
  <meta name="title" content="Agent Talk - Text-to-Speech API for AI Agents">
  <meta name="description" content="Give your AI agent a voice with one API call. Text-to-speech designed for autonomous agents.">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://talk.onhyper.io/">
  <meta property="og:title" content="Agent Talk - Text-to-Speech API for AI Agents">
  <meta property="og:description" content="Give your AI agent a voice with one API call.">
  <meta property="og:image" content="https://talk.onhyper.io/og-image.svg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="https://talk.onhyper.io/">
  <meta name="twitter:title" content="Agent Talk - Text-to-Speech API for AI Agents">
  <meta name="twitter:description" content="Give your AI agent a voice with one API call.">
  <meta name="twitter:image" content="https://talk.onhyper.io/og-image.svg">
  <link rel="canonical" href="https://talk.onhyper.io/">
  <meta name="theme-color" content="#f97316">
  <link rel="stylesheet" href="/app.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/app.js"></script>
</body>
</html>`
    );
  } catch (error) {
    logger.logError('Failed to serve index.html', error);
    return c.text('Internal Server Error', 500);
  }
});