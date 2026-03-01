/**
 * Usage Logs Database Operations
 */

import { getDb } from './index.js';
import { v4 as uuidv4 } from 'uuid';

export interface UsageLog {
  id: string;
  user_id: string;
  api_key_id: string | null;
  action: string;
  metadata: string | null;
  created_at: string;
}

export interface CreateUsageLogData {
  userId: string;
  apiKeyId?: string | null;
  action: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Create a usage log entry
 */
export async function createUsageLog(data: CreateUsageLogData): Promise<UsageLog> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO usage_logs (id, user_id, api_key_id, action, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.userId, data.apiKeyId || null, data.action, 
    data.metadata ? JSON.stringify(data.metadata) : null, now);
  
  return {
    id,
    user_id: data.userId,
    api_key_id: data.apiKeyId || null,
    action: data.action,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    created_at: now,
  };
}

/**
 * Find usage log by ID
 */
export async function findUsageLogById(id: string): Promise<UsageLog | null> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM usage_logs WHERE id = ?').get(id) as any;
  return row || null;
}

/**
 * List usage logs by user
 */
export async function listUsageLogsByUser(userId: string, limit: number = 100): Promise<UsageLog[]> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM usage_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
  `).all(userId, limit) as any[];
  return rows;
}

/**
 * Get usage logs by action
 */
export async function getUsageLogsByAction(action: string, limit: number = 100): Promise<UsageLog[]> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM usage_logs WHERE action = ? ORDER BY created_at DESC LIMIT ?
  `).all(action, limit) as any[];
  return rows;
}

/**
 * Count total usage logs
 */
export async function countTotalUsageLogs(): Promise<number> {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM usage_logs').get() as { count: number };
  return result.count;
}