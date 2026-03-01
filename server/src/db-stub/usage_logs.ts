/**
 * Usage Logs Database Stub
 * 
 * Hybrid implementation that uses HYPR Micro when available,
 * with in-memory fallback for development.
 * 
 * @see task-162-phase3-hypr-micro.md
 */

import { v4 as uuidv4 } from 'uuid';
import { isHyprMode, UsageLogs, UsageLog as MicroUsageLog } from '../lib/micro-tables.js';

export interface UsageLog {
  id: string;
  user_id: string;
  api_key_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  [key: string]: unknown;
}

export interface CreateUsageLogData {
  userId: string;
  apiKeyId?: string | null;
  action: string;
  metadata?: Record<string, unknown> | null;
}

export interface UsageLogStats {
  total: number;
  byAction: Map<string, number>;
}

// In-memory storage for development (fallback)
const logStore = new Map<string, UsageLog>();
const userLogsIndex = new Map<string, Set<string>>();

/**
 * Convert between formats (both use snake_case)
 */
function toLegacyLog(log: MicroUsageLog): UsageLog {
  return log;
}

function toMicroLog(log: UsageLog): MicroUsageLog {
  return log;
}

/**
 * Create a usage log entry
 */
export async function createUsageLog(data: CreateUsageLogData): Promise<UsageLog> {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const log: UsageLog = {
    id,
    user_id: data.userId,
    api_key_id: data.apiKeyId || null,
    action: data.action,
    metadata: data.metadata || null,
    created_at: now,
  };
  
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const microLog = await UsageLogs.create({
      user_id: data.userId,
      api_key_id: data.apiKeyId || null,
      action: data.action,
      metadata: data.metadata || null,
    });
    return toLegacyLog(microLog);
  }
  
  // In-memory fallback
  logStore.set(id, log);
  
  // Update user's log set
  if (!userLogsIndex.has(data.userId)) {
    userLogsIndex.set(data.userId, new Set());
  }
  userLogsIndex.get(data.userId)!.add(id);
  
  return log;
}

/**
 * Find usage log by ID
 */
export async function findUsageLogById(id: string): Promise<UsageLog | null> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const { getMicroClient } = await import('../lib/hypr-micro.js');
    const client = getMicroClient();
    const log = await client.get<MicroUsageLog>('usage_logs', id);
    return log ? toLegacyLog(log) : null;
  }
  
  // In-memory fallback
  return logStore.get(id) || null;
}

/**
 * List usage logs for a user
 */
export async function listUsageLogsByUser(userId: string, limit: number = 100, offset: number = 0): Promise<UsageLog[]> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const logs = await UsageLogs.findByUserId(userId, limit);
    // Apply offset
    return logs.slice(offset, offset + limit).map(toLegacyLog);
  }
  
  // In-memory fallback
  const logIds = userLogsIndex.get(userId);
  if (!logIds) return [];
  
  const logs = Array.from(logIds)
    .map(id => logStore.get(id))
    .filter((l): l is UsageLog => l !== undefined)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  return logs.slice(offset, offset + limit);
}

/**
 * Count usage logs for a user
 */
export async function countUsageLogsByUserId(userId: string): Promise<number> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    return UsageLogs.count(userId);
  }
  
  // In-memory fallback
  const logIds = userLogsIndex.get(userId);
  return logIds ? logIds.size : 0;
}

/**
 * Get usage logs by action type
 */
export async function getUsageLogsByAction(action: string, limit: number = 100): Promise<UsageLog[]> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const logs = await UsageLogs.findByAction(action, limit);
    return logs.map(toLegacyLog);
  }
  
  // In-memory fallback
  const logs = Array.from(logStore.values())
    .filter(log => log.action === action)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  return logs.slice(0, limit);
}

/**
 * Get usage stats for a user
 */
export async function getUsageStats(userId: string, days: number = 30): Promise<UsageLogStats> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffIso = cutoffDate.toISOString();
  
  // Get all logs for user
  const logs = await listUsageLogsByUser(userId, 1000);
  
  // Filter by date and compute stats
  const recentLogs = logs.filter(log => log.created_at >= cutoffIso);
  
  const byAction = new Map<string, number>();
  for (const log of recentLogs) {
    byAction.set(log.action, (byAction.get(log.action) || 0) + 1);
  }
  
  return {
    total: recentLogs.length,
    byAction,
  };
}

/**
 * Get error logs for a user
 */
export async function getErrorLogs(userId: string, limit: number = 50): Promise<UsageLog[]> {
  const logs = await listUsageLogsByUser(userId, 1000);
  
  return logs
    .filter(log => log.action.startsWith('error_'))
    .slice(0, limit);
}

/**
 * Count total usage logs
 */
export async function countTotalUsageLogs(): Promise<number> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    return UsageLogs.count();
  }
  
  // In-memory fallback
  return logStore.size;
}

/**
 * Clear all usage logs (for testing)
 */
export function clearUsageLogs(): void {
  logStore.clear();
  userLogsIndex.clear();
}