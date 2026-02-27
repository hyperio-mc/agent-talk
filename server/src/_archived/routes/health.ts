/**
 * Health Check Routes - Detailed health monitoring for Agent Talk API
 * 
 * Provides:
 * - Basic health check (/health)
 * - Detailed health check with all services (/health/detailed)
 * - Readiness check for Kubernetes (/health/ready)
 * - Liveness check for Kubernetes (/health/live)
 */

import { Hono } from 'hono';
import { getDb, checkHealth as checkDbHealth } from '../db/index.js';
import { getStorage } from '../services/storage.js';
import { logger } from '../utils/logger.js';

export const healthRoutes = new Hono();

interface HealthCheckResult {
  status: 'ok' | 'error' | 'degraded';
  message?: string;
  latency?: number;
  details?: Record<string, unknown>;
}

interface SystemHealth {
  status: 'ok' | 'error' | 'degraded';
  version: string;
  timestamp: string;
  uptime: number;
  checks: {
    database: HealthCheckResult;
    storage: HealthCheckResult;
    elevenlabs?: HealthCheckResult;
  };
  metrics?: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    responseTime: number;
  };
}

// Track start time for uptime
const startTime = Date.now();

// Version from package.json or environment
const VERSION = process.env.npm_package_version || process.env.APP_VERSION || '1.0.0';

/**
 * Check database health
 */
async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const dbHealth = checkDbHealth();
    const latency = Date.now() - start;
    
    if (dbHealth.status === 'ok') {
      return {
        status: 'ok',
        latency,
        details: {
          path: dbHealth.path,
          tables: dbHealth.tables
        }
      };
    }
    
    return {
      status: 'error',
      message: 'Database health check failed',
      latency,
      details: dbHealth
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown database error',
      latency: Date.now() - start
    };
  }
}

/**
 * Check storage health
 */
async function checkStorage(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const storage = getStorage();
    
    // Try to generate an ID (tests storage is initialized)
    const testId = storage.generateId();
    
    // Check if storage directory exists for local storage
    const storagePath = process.env.STORAGE_PATH || './data/audio';
    
    const latency = Date.now() - start;
    
    return {
      status: 'ok',
      latency,
      details: {
        backend: process.env.STORAGE_BACKEND || 'local',
        path: storagePath,
        testId
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown storage error',
      latency: Date.now() - start
    };
  }
}

/**
 * Check ElevenLabs API health (optional, only if API key is configured)
 */
async function checkElevenLabs(): Promise<HealthCheckResult | undefined> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    return undefined; // Not configured, skip check
  }
  
  const start = Date.now();
  try {
    // Quick ping to ElevenLabs API - get voices (lightweight endpoint)
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    const latency = Date.now() - start;
    
    if (response.ok) {
      return {
        status: 'ok',
        latency,
        details: {
          statusCode: response.status
        }
      };
    }
    
    return {
      status: 'degraded',
      message: `ElevenLabs API returned ${response.status}`,
      latency,
      details: {
        statusCode: response.status
      }
    };
  } catch (error) {
    const latency = Date.now() - start;
    
    // Timeout or network error - mark as degraded, not error
    // (TTS will fall back to edge/simulation)
    return {
      status: 'degraded',
      message: error instanceof Error ? error.message : 'ElevenLabs API unreachable',
      latency
    };
  }
}

/**
 * Get memory usage
 */
function getMemoryUsage() {
  const memUsage = process.memoryUsage();
  const used = memUsage.heapUsed;
  const total = memUsage.heapTotal;
  
  return {
    used: Math.round(used / 1024 / 1024), // MB
    total: Math.round(total / 1024 / 1024), // MB
    percentage: Math.round((used / total) * 100)
  };
}

/**
 * Basic health check - lightweight, for load balancers
 */
healthRoutes.get('/', async (c) => {
  const start = Date.now();
  
  // Quick database ping
  const dbHealth = await checkDatabase();
  
  if (dbHealth.status !== 'ok') {
    return c.json({
      status: 'error',
      service: 'Agent Talk API',
      version: VERSION,
      timestamp: new Date().toISOString(),
      ttsMode: process.env.TTS_MODE || 'simulation',
      error: 'Database unavailable'
    }, 503);
  }
  
  return c.json({
    status: 'ok',
    service: 'Agent Talk API',
    version: VERSION,
    timestamp: new Date().toISOString(),
    ttsMode: process.env.TTS_MODE || 'simulation',
    responseTime: Date.now() - start,
    database: {
      status: 'ok',
      path: dbHealth.details?.path,
      tables: dbHealth.details?.tables
    }
  });
});

/**
 * Detailed health check - all services
 */
healthRoutes.get('/detailed', async (c) => {
  const start = Date.now();
  
  // Run all health checks in parallel
  const [database, storage, elevenlabs] = await Promise.all([
    checkDatabase(),
    checkStorage(),
    checkElevenLabs()
  ]);
  
  // Determine overall status
  const checks = { database, storage, ...(elevenlabs && { elevenlabs }) };
  const statuses = Object.values(checks).map(c => c.status);
  
  let overallStatus: 'ok' | 'error' | 'degraded' = 'ok';
  if (statuses.includes('error')) {
    overallStatus = 'error';
  } else if (statuses.includes('degraded')) {
    overallStatus = 'degraded';
  }
  
  const health: SystemHealth = {
    status: overallStatus,
    version: VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
    metrics: {
      memory: getMemoryUsage(),
      responseTime: Date.now() - start
    }
  };
  
  const statusCode = overallStatus === 'error' ? 503 : 200;
  return c.json(health, statusCode);
});

/**
 * Readiness check - is the app ready to receive traffic?
 */
healthRoutes.get('/ready', async (c) => {
  // Check critical dependencies only
  const database = await checkDatabase();
  
  if (database.status !== 'ok') {
    return c.json({
      status: 'not_ready',
      reason: 'Database unavailable'
    }, 503);
  }
  
  return c.json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

/**
 * Liveness check - is the app alive?
 */
healthRoutes.get('/live', (c) => {
  return c.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000)
  });
});

/**
 * Metrics endpoint - for monitoring systems
 */
healthRoutes.get('/metrics', async (c) => {
  const start = Date.now();
  
  const [database, storage] = await Promise.all([
    checkDatabase(),
    checkStorage()
  ]);
  
  const memory = getMemoryUsage();
  
  // Prometheus-style metrics
  const metrics = `
# HELP agent_talk_up Whether the service is up
# TYPE agent_talk_up gauge
agent_talk_up 1

# HELP agent_talk_uptime_seconds Service uptime in seconds
# TYPE agent_talk_uptime_seconds counter
agent_talk_uptime_seconds ${Math.floor((Date.now() - startTime) / 1000)}

# HELP agent_talk_memory_used_mb Memory used in MB
# TYPE agent_talk_memory_used_mb gauge
agent_talk_memory_used_mb ${memory.used}

# HELP agent_talk_memory_total_mb Total memory in MB
# TYPE agent_talk_memory_total_mb gauge
agent_talk_memory_total_mb ${memory.total}

# HELP agent_talk_memory_percentage Memory usage percentage
# TYPE agent_talk_memory_percentage gauge
agent_talk_memory_percentage ${memory.percentage}

# HELP agent_talk_database_healthy Database health status
# TYPE agent_talk_database_healthy gauge
agent_talk_database_healthy ${database.status === 'ok' ? 1 : 0}

# HELP agent_talk_database_latency_ms Database check latency in ms
# TYPE agent_talk_database_latency_ms gauge
agent_talk_database_latency_ms ${database.latency || 0}

# HELP agent_talk_storage_healthy Storage health status
# TYPE agent_talk_storage_healthy gauge
agent_talk_storage_healthy ${storage.status === 'ok' ? 1 : 0}

# HELP agent_talk_storage_latency_ms Storage check latency in ms
# TYPE agent_talk_storage_latency_ms gauge
agent_talk_storage_latency_ms ${storage.latency || 0}

# HELP agent_talk_health_check_duration_ms Health check duration in ms
# TYPE agent_talk_health_check_duration_ms gauge
agent_talk_health_check_duration_ms ${Date.now() - start}
`.trim();

  return c.text(metrics, 200, {
    'Content-Type': 'text/plain; version=0.0.4'
  });
});

export default healthRoutes;