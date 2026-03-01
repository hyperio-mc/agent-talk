/**
 * Analytics Service for Agent Talk API
 * 
 * Provides usage statistics, voice popularity, and error tracking.
 * Uses HYPR Micro for data storage with in-memory fallback.
 */

import { v4 as uuidv4 } from 'uuid';
import { isHyprMode } from '../lib/micro-tables.js';
import {
  createUsageLog,
  listUsageLogsByUser,
  getUsageLogsByAction,
  countTotalUsageLogs,
  UsageLog,
} from '../db/usage_logs.js';
import {
  listMemosByUser,
  countMemosByUserId,
} from '../db/memos.js';

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
 * Log an analytics event
 */
export async function logAnalyticsEvent(input: AnalyticsEventInput): Promise<void> {
  await createUsageLog({
    userId: input.userId,
    apiKeyId: input.apiKeyId || null,
    action: input.eventType,
    metadata: input.eventData || null,
  });
}

/**
 * Log memo creation event
 */
export function logMemoCreated(
  userId: string, 
  apiKeyId: string | null, 
  data: { voice: string; characterCount: number; duration?: number }
): void {
  // Fire and forget - don't await
  logAnalyticsEvent({
    userId,
    apiKeyId,
    eventType: 'memo_created',
    eventData: {
      voice: data.voice,
      characterCount: data.characterCount,
      duration: data.duration,
    },
  }).catch(err => console.error('Failed to log memo_created event:', err));
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
  }).catch(err => console.error('Failed to log memo_failed event:', err));
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
  }).catch(err => console.error('Failed to log key_created event:', err));
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
  }).catch(err => console.error('Failed to log key_revoked event:', err));
}

/**
 * Log API key used event
 */
export function logKeyUsed(userId: string, apiKeyId: string): void {
  logAnalyticsEvent({
    userId,
    apiKeyId,
    eventType: 'key_used',
  }).catch(err => console.error('Failed to log key_used event:', err));
}

/**
 * Log user signup event
 */
export function logUserSignup(userId: string, tier: string = 'hobby'): void {
  logAnalyticsEvent({
    userId,
    eventType: 'user_signup',
    eventData: { tier },
  }).catch(err => console.error('Failed to log user_signup event:', err));
}

/**
 * Log user login event
 */
export function logUserLogin(userId: string): void {
  logAnalyticsEvent({
    userId,
    eventType: 'user_login',
  }).catch(err => console.error('Failed to log user_login event:', err));
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
  }).catch(err => console.error('Failed to log error_api event:', err));
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
  }).catch(err => console.error('Failed to log error_tts event:', err));
}

/**
 * Log rate limit hit event
 */
export function logRateLimitHit(userId: string, apiKeyId: string | null): void {
  logAnalyticsEvent({
    userId,
    apiKeyId,
    eventType: 'error_rate_limit',
  }).catch(err => console.error('Failed to log error_rate_limit event:', err));
}

/**
 * Get usage statistics for a user
 * Returns daily, weekly, and monthly call counts
 */
export async function getUsageStats(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<UsageStats> {
  // Default to last 30 days if no dates provided
  const end = endDate || new Date();
  const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Get memos for user
  const memos = await listMemosByUser(userId, 1000);
  
  // Filter by date range
  const filteredMemos = memos.filter(m => {
    const createdAt = new Date(m.created_at);
    return createdAt >= start && createdAt <= end;
  });
  
  // Calculate daily stats
  const dailyMap = new Map<string, { calls: number; characters: number }>();
  for (const memo of filteredMemos) {
    const date = memo.created_at.split('T')[0];
    const existing = dailyMap.get(date) || { calls: 0, characters: 0 };
    existing.calls++;
    existing.characters += memo.character_count || 0;
    dailyMap.set(date, existing);
  }
  
  const daily: DailyStats[] = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
  
  // Calculate weekly stats
  const weeklyMap = new Map<string, { calls: number; characters: number }>();
  for (const memo of filteredMemos) {
    const date = new Date(memo.created_at);
    const week = getWeek(date);
    const existing = weeklyMap.get(week) || { calls: 0, characters: 0 };
    existing.calls++;
    existing.characters += memo.character_count || 0;
    weeklyMap.set(week, existing);
  }
  
  const weekly: WeeklyStats[] = Array.from(weeklyMap.entries())
    .map(([week, stats]) => ({ week, ...stats }))
    .sort((a, b) => b.week.localeCompare(a.week))
    .slice(0, 12);
  
  // Calculate monthly stats
  const monthlyMap = new Map<string, { calls: number; characters: number }>();
  for (const memo of filteredMemos) {
    const month = memo.created_at.substring(0, 7); // YYYY-MM
    const existing = monthlyMap.get(month) || { calls: 0, characters: 0 };
    existing.calls++;
    existing.characters += memo.character_count || 0;
    monthlyMap.set(month, existing);
  }
  
  const monthly: MonthlyStats[] = Array.from(monthlyMap.entries())
    .map(([month, stats]) => ({ month, ...stats }))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12);
  
  return {
    total: filteredMemos.length,
    daily,
    weekly,
    monthly,
  };
}

/**
 * Get week string for a date (YYYY-WW format)
 */
function getWeek(date: Date): string {
  const year = date.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - oneJan.getTime()) / 86400000);
  const weekNumber = Math.ceil((days + oneJan.getDay() + 1) / 7);
  return `${year}-${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Get voice popularity for a user
 * Returns most used voices with counts and percentages
 */
export async function getVoicePopularity(userId: string): Promise<VoicePopularity[]> {
  // Get all memos for user
  const memos = await listMemosByUser(userId, 1000);
  
  // Count by voice
  const voiceCounts = new Map<string, number>();
  let total = 0;
  
  for (const memo of memos) {
    if (memo.voice) {
      voiceCounts.set(memo.voice, (voiceCounts.get(memo.voice) || 0) + 1);
      total++;
    }
  }
  
  // Map voice IDs to names
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
  
  // Sort by count and calculate percentages
  return Array.from(voiceCounts.entries())
    .map(([voiceId, callCount]) => ({
      voiceId,
      voiceName: voiceNames[voiceId] || voiceId,
      callCount,
      percentage: total > 0 ? Math.round((callCount / total) * 100 * 10) / 10 : 0,
    }))
    .sort((a, b) => b.callCount - a.callCount);
}

/**
 * Get error statistics for a user
 * Returns error rates and breakdown by type
 */
export async function getErrorStats(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ErrorStats> {
  // Default to last 30 days if no dates provided
  const end = endDate || new Date();
  const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const startStr = start.toISOString();
  const endStr = end.toISOString();
  
  // Get memos for total requests
  const memos = await listMemosByUser(userId, 1000);
  const totalRequests = memos.filter(m => 
    m.created_at >= startStr && m.created_at <= endStr
  ).length;
  
  // Get error logs
  const logs = await listUsageLogsByUser(userId, 1000);
  const errorLogs = logs.filter(log => 
    log.action.startsWith('error_') &&
    log.created_at >= startStr &&
    log.created_at <= endStr
  );
  
  // Group by error type
  const errorTypeCounts = new Map<string, number>();
  for (const log of errorLogs) {
    errorTypeCounts.set(log.action, (errorTypeCounts.get(log.action) || 0) + 1);
  }
  
  const totalErrors = errorLogs.length;
  
  // Calculate error rate
  const errorRate = totalRequests + totalErrors > 0 
    ? Math.round((totalErrors / (totalRequests + totalErrors)) * 100 * 10) / 10 
    : 0;
  
  // Format error types
  const errorsByType = Array.from(errorTypeCounts.entries())
    .map(([action, count]) => ({
      errorType: action.replace('error_', '').replace(/_/g, ' '),
      count,
      percentage: totalErrors > 0 ? Math.round((count / totalErrors) * 100 * 10) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
  
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
export async function getDashboardSummary(userId: string): Promise<{
  totalCalls: number;
  totalCharacters: number;
  avgCharactersPerCall: number;
  mostUsedVoice: string | null;
  callsToday: number;
  callsThisWeek: number;
  callsThisMonth: number;
}> {
  // Get all memos for user
  const memos = await listMemosByUser(userId, 1000);
  
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  // Calculate totals
  let totalCalls = 0;
  let totalCharacters = 0;
  let callsToday = 0;
  let callsThisWeek = 0;
  let callsThisMonth = 0;
  const voiceCounts = new Map<string, number>();
  
  for (const memo of memos) {
    totalCalls++;
    totalCharacters += memo.character_count || 0;
    
    if (memo.created_at >= todayStart) {
      callsToday++;
    }
    if (memo.created_at >= weekStart) {
      callsThisWeek++;
    }
    if (memo.created_at >= monthStart) {
      callsThisMonth++;
    }
    
    if (memo.voice) {
      voiceCounts.set(memo.voice, (voiceCounts.get(memo.voice) || 0) + 1);
    }
  }
  
  // Find most used voice
  let mostUsedVoice: string | null = null;
  let maxCount = 0;
  for (const [voice, count] of voiceCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mostUsedVoice = voice;
    }
  }
  
  return {
    totalCalls,
    totalCharacters,
    avgCharactersPerCall: totalCalls > 0 ? Math.round(totalCharacters / totalCalls) : 0,
    mostUsedVoice,
    callsToday,
    callsThisWeek,
    callsThisMonth,
  };
}