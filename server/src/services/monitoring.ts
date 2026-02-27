/**
 * Monitoring Service - Metrics collection and alerting for Agent Talk API
 * 
 * Features:
 * - Request timing metrics (P50, P95, P99)
 * - Error rate tracking
 * - Alerting on error spikes
 * - Structured logging for external services
 */

import { logger } from '../utils/logger.js';

// Types
interface MetricEntry {
  timestamp: number;
  value: number;
}

interface RequestMetric {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  timestamp: number;
}

interface ErrorMetric {
  type: string;
  message: string;
  path?: string;
  timestamp: number;
}

interface MetricsSummary {
  requests: {
    total: number;
    errors: number;
    errorRate: number;
    avgDuration: number;
    p50: number;
    p95: number;
    p99: number;
  };
  errors: {
    last5Minutes: number;
    last15Minutes: number;
    lastHour: number;
    byType: Record<string, number>;
  };
  alerts: Alert[];
}

interface Alert {
  type: 'error_spike' | 'health_failure' | 'latency_spike';
  message: string;
  timestamp: number;
  severity: 'warning' | 'critical';
}

// Configuration
const ERROR_SPIKE_THRESHOLD = 10; // Alert if >10 errors in 5 minutes
const ERROR_SPIKE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LATENCY_SPIKE_THRESHOLD_MS = 2000; // Alert if P95 > 2 seconds
const MAX_METRICS_AGE_MS = 60 * 60 * 1000; // Keep metrics for 1 hour

// In-memory storage (for single-instance deployment)
// For multi-instance, use Redis or external metrics service
class MetricsStore {
  private requests: RequestMetric[] = [];
  private errors: ErrorMetric[] = [];
  private alerts: Alert[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up old metrics every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup() {
    const cutoff = Date.now() - MAX_METRICS_AGE_MS;
    this.requests = this.requests.filter(r => r.timestamp > cutoff);
    this.errors = this.errors.filter(e => e.timestamp > cutoff);
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
  }

  recordRequest(metric: RequestMetric) {
    this.requests.push(metric);
  }

  recordError(metric: ErrorMetric) {
    this.errors.push(metric);
    this.checkErrorSpike();
  }

  private checkErrorSpike() {
    const recentErrors = this.getErrorCount(ERROR_SPIKE_WINDOW_MS);
    
    if (recentErrors >= ERROR_SPIKE_THRESHOLD) {
      const alert: Alert = {
        type: 'error_spike',
        message: `Error spike detected: ${recentErrors} errors in the last ${ERROR_SPIKE_WINDOW_MS / 60000} minutes`,
        timestamp: Date.now(),
        severity: recentErrors >= ERROR_SPIKE_THRESHOLD * 2 ? 'critical' : 'warning'
      };
      
      this.alerts.push(alert);
      logger.warn('ALERT: ' + alert.message, { severity: alert.severity });
    }
  }

  getErrorCount(windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    return this.errors.filter(e => e.timestamp > cutoff).length;
  }

  getRequests(since?: number): RequestMetric[] {
    if (!since) return [...this.requests];
    return this.requests.filter(r => r.timestamp > since);
  }

  getErrors(since?: number): ErrorMetric[] {
    if (!since) return [...this.errors];
    return this.errors.filter(e => e.timestamp > since);
  }

  getAlerts(since?: number): Alert[] {
    if (!since) return [...this.alerts];
    return this.alerts.filter(a => a.timestamp > since);
  }

  clearAlerts() {
    this.alerts = [];
  }

  addAlert(alert: Alert) {
    this.alerts.push(alert);
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance
let metricsStore: MetricsStore | null = null;

export function getMetricsStore(): MetricsStore {
  if (!metricsStore) {
    metricsStore = new MetricsStore();
  }
  return metricsStore;
}

/**
 * Record a request metric
 */
export function recordRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number
): void {
  const store = getMetricsStore();
  
  store.recordRequest({
    method,
    path: sanitizePath(path),
    statusCode,
    duration,
    timestamp: Date.now()
  });
  
  // Log slow requests
  if (duration > 1000) {
    logger.warn('Slow request', { method, path, duration, statusCode });
  }
}

/**
 * Record an error metric
 */
export function recordError(
  type: string,
  message: string,
  path?: string
): void {
  const store = getMetricsStore();
  
  store.recordError({
    type,
    message,
    path: path ? sanitizePath(path) : undefined,
    timestamp: Date.now()
  });
  
  logger.error('Error recorded', { type, message, path });
}

/**
 * Get metrics summary
 */
export function getMetricsSummary(): MetricsSummary {
  const store = getMetricsStore();
  const now = Date.now();
  
  // Request metrics
  const requests = store.getRequests(now - MAX_METRICS_AGE_MS);
  const durations = requests.map(r => r.duration).sort((a, b) => a - b);
  const errors = requests.filter(r => r.statusCode >= 400);
  
  const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
  const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;
  const p99 = durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0;
  const avgDuration = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / durations.length 
    : 0;

  // Error metrics
  const errorMetrics = store.getErrors();
  const errorTypes: Record<string, number> = {};
  for (const e of errorMetrics) {
    errorTypes[e.type] = (errorTypes[e.type] || 0) + 1;
  }

  // Check for latency spike
  if (p95 > LATENCY_SPIKE_THRESHOLD_MS) {
    const alert: Alert = {
      type: 'latency_spike',
      message: `High latency detected: P95 = ${p95}ms`,
      timestamp: now,
      severity: 'warning'
    };
    metricsStore!.addAlert(alert);
    logger.warn('ALERT: ' + alert.message);
  }

  return {
    requests: {
      total: requests.length,
      errors: errors.length,
      errorRate: requests.length > 0 ? errors.length / requests.length : 0,
      avgDuration: Math.round(avgDuration),
      p50,
      p95,
      p99
    },
    errors: {
      last5Minutes: store.getErrorCount(5 * 60 * 1000),
      last15Minutes: store.getErrorCount(15 * 60 * 1000),
      lastHour: store.getErrorCount(60 * 60 * 1000),
      byType: errorTypes
    },
    alerts: store.getAlerts(now - 15 * 60 * 1000) // Last 15 minutes
  };
}

/**
 * Sanitize path for metrics (remove IDs, etc.)
 */
function sanitizePath(path: string): string {
  return path
    .replace(/\/[a-f0-9-]{36}/g, '/:id') // UUIDs
    .replace(/\/\d+/g, '/:id') // Numeric IDs
    .replace(/\?.*$/, ''); // Query strings
}

/**
 * Calculate percentiles
 */
export function calculatePercentiles(values: number[]): { p50: number; p95: number; p99: number } {
  if (values.length === 0) {
    return { p50: 0, p95: 0, p99: 0 };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  
  return {
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  };
}

/**
 * Health check for consecutive failures
 */
export class HealthChecker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private consecutiveFailureThreshold: number;
  private resetAfterMs: number;

  constructor(consecutiveFailureThreshold = 3, resetAfterMs = 60000) {
    this.consecutiveFailureThreshold = consecutiveFailureThreshold;
    this.resetAfterMs = resetAfterMs;
  }

  recordFailure(): boolean {
    const now = Date.now();
    
    // Reset if too much time has passed
    if (now - this.lastFailureTime > this.resetAfterMs) {
      this.failures = 0;
    }
    
    this.failures++;
    this.lastFailureTime = now;
    
    // Check threshold
    if (this.failures >= this.consecutiveFailureThreshold) {
      recordError(
        'health_check_failure',
        `${this.failures} consecutive health check failures`,
        '/health'
      );
      return true; // Alert triggered
    }
    
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
  }

  getStatus(): { failures: number; lastFailureTime: number; isAlerting: boolean } {
    return {
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      isAlerting: this.failures >= this.consecutiveFailureThreshold
    };
  }
}

// Export singleton health checker
export const healthChecker = new HealthChecker();

export default {
  recordRequest,
  recordError,
  getMetricsSummary,
  getMetricsStore,
  calculatePercentiles,
  HealthChecker,
  healthChecker
};