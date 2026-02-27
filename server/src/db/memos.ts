/**
 * Memos Database - HYPR Micro Implementation
 * 
 * Manages memo/voice record metadata in HYPR Micro with in-memory fallback.
 * 
 * @see HYPR-REFACTOR-PLAN.md Phase 3
 */

import { getMicroClient } from '../lib/hypr-micro.js';
import { isHyprMode, DB_NAMES } from './index.js';
import { logger } from '../utils/logger.js';

export interface Memo {
  id: string;
  user_id: string;
  title: string | null;
  transcription: string | null;
  summary: string | null;
  audio_url: string | null;
  duration_sec: number;
  status: 'pending' | 'transcribed' | 'failed';
  created_at: string;
  updated_at: string;
  [key: string]: unknown; // Index signature for HYPR Micro compatibility
}

// In-memory fallback storage
const memoryMemos = new Map<string, Memo>();

/**
 * Create a new memo
 */
export async function createMemo(data: {
  userId: string;
  audioUrl?: string;
  durationSec?: number;
  title?: string;
}): Promise<Memo> {
  const id = generateId();
  const now = new Date().toISOString();
  
  const memo: Memo = {
    id,
    user_id: data.userId,
    title: data.title || null,
    transcription: null,
    summary: null,
    audio_url: data.audioUrl || null,
    duration_sec: data.durationSec || 0,
    status: 'pending',
    created_at: now,
    updated_at: now,
  };

  if (isHyprMode()) {
    try {
      await getMicroClient().insert(DB_NAMES.MEMOS, memo);
      logger.debug('Memo created in HYPR Micro', { id });
    } catch (error: unknown) {
      logger.error('Failed to create memo in HYPR Micro', { error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      throw error;
    }
  } else {
    memoryMemos.set(id, memo);
    logger.debug('Memo created in memory', { id });
  }

  return memo;
}

/**
 * Get memos by user ID
 */
export async function getMemosByUserId(userId: string): Promise<Memo[]> {
  if (isHyprMode()) {
    try {
      const memos = await getMicroClient().query<Memo>(DB_NAMES.MEMOS, { user_id: userId });
      return memos.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error: unknown) {
      logger.error('Failed to get memos from HYPR Micro', { userId, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return [];
    }
  }
  
  return Array.from(memoryMemos.values())
    .filter(m => m.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// Alias for compatibility
export const listMemosByUser = getMemosByUserId;

/**
 * Get memo by ID
 */
export async function getMemoById(id: string): Promise<Memo | null> {
  if (isHyprMode()) {
    try {
      return await getMicroClient().get<Memo>(DB_NAMES.MEMOS, id);
    } catch (error: unknown) {
      logger.error('Failed to get memo from HYPR Micro', { id, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return null;
    }
  }
  
  return memoryMemos.get(id) || null;
}

/**
 * Delete a memo
 */
export async function deleteMemo(id: string): Promise<boolean> {
  if (isHyprMode()) {
    try {
      return await getMicroClient().delete(DB_NAMES.MEMOS, id);
    } catch (error: unknown) {
      logger.error('Failed to delete memo from HYPR Micro', { id, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return false;
    }
  }
  
  return memoryMemos.delete(id);
}

/**
 * Get all memos (admin only)
 */
export async function getAllMemos(): Promise<Memo[]> {
  if (isHyprMode()) {
    try {
      const { docs } = await getMicroClient().list<Memo>(DB_NAMES.MEMOS);
      return docs;
    } catch (error: unknown) {
      logger.error('Failed to get all memos from HYPR Micro', { error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return [];
    }
  }
  
  return Array.from(memoryMemos.values());
}

/**
 * Count memos by user ID
 */
export async function countMemosByUserId(userId: string): Promise<number> {
  if (isHyprMode()) {
    try {
      const memos = await getMicroClient().query<Memo>(DB_NAMES.MEMOS, { user_id: userId });
      return memos.length;
    } catch (error: unknown) {
      logger.error('Failed to count memos in HYPR Micro', { userId, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return 0;
    }
  }
  
  return Array.from(memoryMemos.values()).filter(m => m.user_id === userId).length;
}

/**
 * Update memo status and content
 */
export async function updateMemo(id: string, data: Partial<{
  title: string;
  transcription: string;
  summary: string;
  status: 'pending' | 'transcribed' | 'failed';
}>): Promise<Memo | null> {
  if (isHyprMode()) {
    try {
      return await getMicroClient().update<Memo>(DB_NAMES.MEMOS, id, {
        ...data,
        updated_at: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Failed to update memo in HYPR Micro', { id, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return null;
    }
  }
  
  const memo = memoryMemos.get(id);
  if (!memo) return null;
  
  const updated: Memo = {
    ...memo,
    ...data,
    updated_at: new Date().toISOString(),
  };
  memoryMemos.set(id, updated);
  
  return updated;
}

/**
 * Get memo counts by day (for analytics)
 */
export async function getMemoCountsByDay(userId: string, days: number = 30): Promise<{ date: string; count: number }[]> {
  const memos = await getMemosByUserId(userId);
  
  // Group by date
  const counts = new Map<string, number>();
  const now = new Date();
  
  // Initialize last N days with 0
  for (let i = 0; i < days; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    counts.set(dateStr, 0);
  }
  
  // Count memos per day
  for (const memo of memos) {
    const dateStr = memo.created_at.split('T')[0];
    const current = counts.get(dateStr) || 0;
    counts.set(dateStr, current + 1);
  }
  
  // Convert to array
  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Generate unique ID
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `memo_${timestamp}_${random}`;
}