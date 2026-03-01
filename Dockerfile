# Agent Talk Production Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY package-lock.json ./

# Install root dependencies (for Vite/Svelte build)
RUN npm ci

# Copy frontend source
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./
COPY vite.config.js ./
COPY svelte.config.js ./
COPY jsconfig.json ./

# Build frontend
RUN npm run build

# Stage 2: Build the server
FROM node:20-alpine AS server-builder

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ sqlite-dev

WORKDIR /app/server

# Copy server package files
COPY server/package*.json ./
COPY server/package-lock.json ./
COPY server/tsconfig.json ./

# Install server dependencies
RUN npm ci

# Copy server source
COPY server/src/ ./src/

# Build server
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS production

WORKDIR /app

# Install SQLite tools for database operations
RUN apk add --no-cache sqlite

# Install build tools for native modules (needed for better-sqlite3)
RUN apk add --no-cache python3 make g++ sqlite-dev

# Copy server package files and install production dependencies only
COPY server/package*.json ./
RUN npm ci --only=production

# Rebuild native modules for Alpine Linux
RUN npm rebuild better-sqlite3

# Copy built server
COPY --from=server-builder /app/server/dist ./dist

# Copy frontend build to public directory
COPY --from=frontend-builder /app/dist ./public

# Copy public assets (favicon, og-image, etc.)
COPY public/ ./public/

# Create data directory for SQLite database and audio files
RUN mkdir -p /app/data/audio

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/app/data/agent-talk.db
ENV STORAGE_PATH=/app/data/audio
ENV BASE_URL=https://talk.onhyper.io

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start server
CMD ["node", "dist/index.js"]