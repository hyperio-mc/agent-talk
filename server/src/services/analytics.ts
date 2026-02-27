/**
 * Analytics Service for Agent Talk API
 * 
 * Provides usage statistics, voice popularity, and error tracking.
 */

import { getDb } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

// Event types for analytics
export type AnalyticsEventType = 
  | 'memo_created'
  | 'memo_failed'
  | 'key_created'
  | 'key_revoked'
  | 'key_used'
  | 'user_login'
  | 'user_signup'
  | 'error_api'
  | 'error_tts'
  | 'error_rate_limit';

export interface AnalyticsEventInput {
  userId: string;
  apiKeyId?: string | null;
  eventType: AnalyticsEventType;
  eventData?: Record<string, unknown>;
}

export interface AnalyticsEvent {
  id: string;
  user_id: string;
  api_key_id: string | null;
  action: string;
  metadata: string | null;
  created_at: string;
}

/**
 * Log an analytics event
 * Writes to the usage_logs table
 */
export function logAnalyticsEvent(input: AnalyticsEventInput): void {
  const db = getDb();
  
  const id = uuidv4();
  const now = new Date().toISOString();
  const metadata = input.eventData ? JSON.stringify(input.eventData) : null;
  
  const stmt = db.prepare(`
    INSERT INTO usage_logs (id, user_id, api_key_id, action, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    input.userId,
    input.apiKeyId || null,
    input.eventType,
    metadata,
    now
  );
}

/**
 * Log memo creation event
 */
export function logMemoCreated(
  userId: string, 
  apiKeyId: string | null, 
  data: { voice: string; characterCount: number; duration?: number }
): void {
  logAnalyticsEvent({
    userId,
    apiKeyId,
    eventType: 'memo_created',
    eventData: {
      voice: data.voice,
      characterCount: data.characterCount,
      duration: data.duration,
    },
  });
}

/**
 * Log memo failure event
 */
export function logMemoFailed(
  userId: string | null,
  apiKeyId: string | null,
  data: { error: string; voice?: string; textLength?: number }
): void {
  if (!userId) return;
  
  logAnalyticsEvent({
    userId,
    apiKeyId,
    eventType: 'memo_failed',
    eventData: {
      error: data.error,
      voice: data.voice,
      textLength: data.textLength,
    },
  });
}

/**
 * Log API key created event
 */
export function logKeyCreated(userId: string, keyName?: string): void {
  logAnalyticsEvent({
    userId,
    eventType: 'key_created',
    eventData: {
      keyName: keyName,
    },
  });
}

/**
 * Log API key revoked event
 */
export function logKeyRevoked(userId: string, keyId: string): void {
  logAnalyticsEvent({
    userId,
    eventType: 'key_revoked',
    eventData: {
      keyId,
    },
  });
}

/**
 * Log API key used event
 */
export function logKeyUsed(userId: string, apiKeyId: string): void {
  logAnalyticsEvent({
    userId,
    apiKeyId,
    eventType: 'key_used',
  });
}

/**
 * Log user signup event
 */
export function logUserSignup(userId: string, tier: string = 'hobby'): void {
  logAnalyticsEvent({
    userId,
    eventType: 'user_signup',
    eventData: { tier },
  });
}

/**
 * Log user login event
 */
export function logUserLogin(userId: string): void {
  logAnalyticsEvent({
    userId,
    eventType: 'user_login',
  });
}

/**
 * Log API error event
 */
export function logApiError(
  userId: string | null,
  apiKeyId: string | null,
  error: string,
  endpoint?: string
): void {
  if (!userId) return;
  
  logAnalyticsEvent({
    userId,
    apiKeyId,
    eventType: 'error_api',
    eventData: {
      error,
      endpoint,
    },
  });
}

/**
 * Log TTS error event
 */
export function logTtsError(
  userId: string,
  apiKeyId: string | null,
  error: string,
  voice?: string
): void {
  logAnalyticsEvent({
    userId,
    apiKeyId,
    eventType: 'error_tts',
    eventData: {
      error,
      voice,
    },
  });
}

/**
 * Log rate limit hit event
 */
export function logRateLimitHit(userId: string, apiKeyId: string | null): void {
  logAnalyticsEvent({
    userId,
    apiKeyId,
    eventType: 'error_rate_limit',
  });
}

export interface UsageStats {
  total: number;
  daily: DailyStats[];
  weekly: WeeklyStats[];
  monthly: MonthlyStats[];
}

export interface DailyStats {
  date: string;
  calls: number;
  characters: number;
}

export interface WeeklyStats {
  week: string;
  calls: number;
  characters: number;
}

export interface MonthlyStats {
  month: string;
  calls: number;
  characters: number;
}

export interface VoicePopularity {
  voiceId: string;
  voiceName: string;
  callCount: number;
  percentage: number;
}

export interface ErrorStats {
  totalRequests: number;
  totalErrors: number;
  errorRate: number;
  errorsByType: ErrorTypeStats[];
}

export interface ErrorTypeStats {
  errorType: string;
  count: number;
  percentage: number;
}

/**
 * Get usage statistics for a user
 * Returns daily, weekly, and monthly call counts
 */
export function getUsageStats(
  userId: string,
  startDate?: Date,
  endDate?: Date
): UsageStats {
  const db = getDb();
  
  // Default to last 30 days if no dates provided
  const end = endDate || new Date();
  const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const startStr = start.toISOString();
  const endStr = end.toISOString();
  
  // Get total calls from memos table
  const totalStmt = db.prepare(`
    SELECT COUNT(*) as total
    FROM memos
    WHERE user_id = ? AND created_at >= ? AND created_at <= ?
  `);
  const totalResult = totalStmt.get(userId, startStr, endStr) as { total: number };
  
  // Get daily stats
  const dailyStmt = db.prepare(`
    SELECT 
      date(created_at) as date,
      COUNT(*) as calls,
      COALESCE(SUM(character_count), 0) as characters
    FROM memos
    WHERE user_id = ? AND created_at >= ? AND created_at <= ?
    GROUP BY date(created_at)
    ORDER BY date DESC
    LIMIT 30
  `);
  const dailyResults = dailyStmt.all(userId, startStr, endStr) as DailyStats[];
  
  // Get weekly stats
  const weeklyStmt = db.prepare(`
    SELECT 
      strftime('%Y-%W', created_at) as week,
      COUNT(*) as calls,
      COALESCE(SUM(character_count), 0) as characters
    FROM memos
    WHERE user_id = ? AND created_at >= ? AND created_at <= ?
    GROUP BY strftime('%Y-%W', created_at)
    ORDER BY week DESC
    LIMIT 12
  `);
  const weeklyResults = weeklyStmt.all(userId, startStr, endStr) as WeeklyStats[];
  
  // Get monthly stats
  const monthlyStmt = db.prepare(`
    SELECT 
      strftime('%Y-%m', created_at) as month,
      COUNT(*) as calls,
      COALESCE(SUM(character_count), 0) as characters
    FROM memos
    WHERE user_id = ? AND created_at >= ? AND created_at <= ?
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month DESC
    LIMIT 12
  `);
  const monthlyResults = monthlyStmt.all(userId, startStr, endStr) as MonthlyStats[];
  
  return {
    total: totalResult?.total || 0,
    daily: dailyResults,
    weekly: weeklyResults,
    monthly: monthlyResults,
  };
}

/**
 * Get voice popularity for a user
 * Returns most used voices with counts and percentages
 */
export function getVoicePopularity(userId: string): VoicePopularity[] {
  const db = getDb();
  
  // Get total calls for percentage calculation
  const totalStmt = db.prepare(`
    SELECT COUNT(*) as total
    FROM memos
    WHERE user_id = ?
  `);
  const totalResult = totalStmt.get(userId) as { total: number };
  const total = totalResult?.total || 0;
  
  // Get voice usage counts
  const stmt = db.prepare(`
    SELECT 
      voice as voiceId,
      COUNT(*) as callCount
    FROM memos
    WHERE user_id = ?
    GROUP BY voice
    ORDER BY callCount DESC
  `);
  const results = stmt.all(userId) as { voiceId: string; callCount: number }[];
  
  // Map voice IDs to names and calculate percentages
  const voiceNames: Record<string, string> = {
    rachel: 'Rachel',
    domi: 'Domi',
    bella: 'Bella',
    adam: 'Adam',
    sam: 'Sam',
    charlie: 'Charlie',
    emily: 'Emily',
    ethan: 'Ethan',
    freya: 'Freya',
    dorothy: 'Dorothy',
    bill: 'Bill',
    sarah: 'Sarah',
  };
  
  return results.map(result => ({
    voiceId: result.voiceId,
    voiceName: voiceNames[result.voiceId] || result.voiceId,
    callCount: result.callCount,
    percentage: total > 0 ? Math.round((result.callCount / total) * 100 * 10) / 10 : 0,
  }));
}

/**
 * Get error statistics for a user
 * Returns error rates and breakdown by type
 */
export function getErrorStats(
  userId: string,
  startDate?: Date,
  endDate?: Date
): ErrorStats {
  const db = getDb();
  
  // Default to last 30 days if no dates provided
  const end = endDate || new Date();
  const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const startStr = start.toISOString();
  const endStr = end.toISOString();
  
  // Get total requests (successful memo creations)
  const successStmt = db.prepare(`
    SELECT COUNT(*) as total
    FROM memos
    WHERE user_id = ? AND created_at >= ? AND created_at <= ?
  `);
  const successResult = successStmt.get(userId, startStr, endStr) as { total: number };
  
  // Get error logs from usage_logs table
  // We'll look for failed actions
  const errorStmt = db.prepare(`
    SELECT 
      action,
      metadata,
      COUNT(*) as count
    FROM usage_logs
    WHERE user_id = ? 
      AND created_at >= ? 
      AND created_at <= ?
      AND action LIKE 'error_%'
    GROUP BY action
    ORDER BY count DESC
  `);
  const errorResults = errorStmt.all(userId, startStr, endStr) as { action: string; metadata: string | null; count: number }[];
  
  const totalRequests = successResult?.total || 0;
  const totalErrors = errorResults.reduce((sum, e) => sum + e.count, 0);
  
  // Calculate error rate
  const errorRate = totalRequests + totalErrors > 0 
    ? Math.round((totalErrors / (totalRequests + totalErrors)) * 100 * 10) / 10 
    : 0;
  
  // Format error types
  const errorsByType = errorResults.map(e => ({
    errorType: e.action.replace('error_', '').replace(/_/g, ' '),
    count: e.count,
    percentage: totalErrors > 0 ? Math.round((e.count / totalErrors) * 100 * 10) / 10 : 0,
  }));
  
  return {
    totalRequests,
    totalErrors,
    errorRate,
    errorsByType,
  };
}

/**
 * Get overall summary for a user's dashboard
 */
export function getDashboardSummary(userId: string): {
  totalCalls: number;
  totalCharacters: number;
  avgCharactersPerCall: number;
  mostUsedVoice: string | null;
  callsToday: number;
  callsThisWeek: number;
  callsThisMonth: number;
} {
  const db = getDb();
  
  // Total stats
  const totalStmt = db.prepare(`
    SELECT 
      COUNT(*) as totalCalls,
      COALESCE(SUM(character_count), 0) as totalCharacters
    FROM memos
    WHERE user_id = ?
  `);
  const totalResult = totalStmt.get(userId) as { totalCalls: number; totalCharacters: number };
  
  // Most used voice
  const voiceStmt = db.prepare(`
    SELECT voice
    FROM memos
    WHERE user_id = ?
    GROUP BY voice
    ORDER BY COUNT(*) DESC
    LIMIT 1
  `);
  const voiceResult = voiceStmt.get(userId) as { voice: string } | undefined;
  
  // Today's calls
  const todayStmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM memos
    WHERE user_id = ? AND date(created_at) = date('now')
  `);
  const todayResult = todayStmt.get(userId) as { count: number };
  
  // This week's calls
  const weekStmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM memos
    WHERE user_id = ? AND strftime('%Y-%W', created_at) = strftime('%Y-%W', 'now')
  `);
  const weekResult = weekStmt.get(userId) as { count: number };
  
  // This month's calls
  const monthStmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM memos
    WHERE user_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `);
  const monthResult = monthStmt.get(userId) as { count: number };
  
  const totalCalls = totalResult?.totalCalls || 0;
  const totalCharacters = totalResult?.totalCharacters || 0;
  
  return {
    totalCalls,
    totalCharacters,
    avgCharactersPerCall: totalCalls > 0 ? Math.round(totalCharacters / totalCalls) : 0,
    mostUsedVoice: voiceResult?.voice || null,
    callsToday: todayResult?.count || 0,
    callsThisWeek: weekResult?.count || 0,
    callsThisMonth: monthResult?.count || 0,
  };
}
