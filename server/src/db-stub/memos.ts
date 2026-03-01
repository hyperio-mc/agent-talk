/**
 * Memos Database Stub
 * 
 * Hybrid implementation that uses HYPR Micro when available,
 * with in-memory fallback for development.
 * 
 * @see task-162-phase3-hypr-micro.md
 */

import { v4 as uuidv4 } from 'uuid';
import { isHyprMode, Memos, Memo as MicroMemo } from '../lib/micro-tables.js';

export interface Memo {
  id: string;
  user_id: string;
  audio_url: string;
  duration_seconds: number;
  voice?: string;
  character_count?: number;
  title?: string;
  created_at: string;
  [key: string]: unknown;
}

export interface CreateMemoData {
  userId: string;
  audioUrl: string;
  durationSeconds: number;
  voice?: string;
  characterCount?: number;
  title?: string;
}

export interface MemoCountsByDay {
  date: string;
  count: number;
}

// In-memory storage for development (fallback)
const memoStore = new Map<string, Memo>();
const userMemosIndex = new Map<string, Set<string>>();

/**
 * Convert between formats
 */
function toLegacyMemo(memo: MicroMemo): Memo {
  return {
    id: memo.id,
    user_id: memo.user_id,
    audio_url: memo.audio_url,
    duration_seconds: memo.duration_seconds,
    voice: memo.voice,
    character_count: memo.character_count,
    title: memo.title,
    created_at: memo.created_at,
  } as Memo;
}

function toMicroMemo(memo: Memo): MicroMemo {
  return {
    id: memo.id,
    user_id: memo.user_id,
    audio_url: memo.audio_url,
    duration_seconds: memo.duration_seconds,
    voice: memo.voice,
    character_count: memo.character_count,
    title: memo.title,
    created_at: memo.created_at,
  } as MicroMemo;
}

/**
 * Create a memo
 */
export async function createMemo(data: CreateMemoData): Promise<Memo> {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const memo: Memo = {
    id,
    user_id: data.userId,
    audio_url: data.audioUrl,
    duration_seconds: data.durationSeconds,
    voice: data.voice,
    character_count: data.characterCount,
    title: data.title,
    created_at: now,
  } as Memo;
  
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const microMemo = await Memos.create(toMicroMemo(memo));
    return toLegacyMemo(microMemo);
  }
  
  // In-memory fallback
  memoStore.set(id, memo);
  
  // Update user's memo set
  if (!userMemosIndex.has(data.userId)) {
    userMemosIndex.set(data.userId, new Set());
  }
  userMemosIndex.get(data.userId)!.add(id);
  
  return memo;
}

/**
 * Find memo by ID
 */
export async function findMemoById(id: string): Promise<Memo | null> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const memo = await Memos.findById(id);
    return memo ? toLegacyMemo(memo) : null;
  }
  
  // In-memory fallback
  return memoStore.get(id) || null;
}

/**
 * List memos for a user
 */
export async function listMemosByUser(userId: string, limit: number = 100, offset: number = 0): Promise<Memo[]> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const memos = await Memos.findByUserId(userId, limit, offset);
    return memos.map(toLegacyMemo);
  }
  
  // In-memory fallback
  const memoIds = userMemosIndex.get(userId);
  if (!memoIds) return [];
  
  const memos = Array.from(memoIds)
    .map(id => memoStore.get(id))
    .filter((m): m is Memo => m !== undefined)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  return memos.slice(offset, offset + limit);
}

/**
 * Count memos for a user
 */
export async function countMemosByUserId(userId: string): Promise<number> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    return Memos.countByUser(userId);
  }
  
  // In-memory fallback
  const memoIds = userMemosIndex.get(userId);
  return memoIds ? memoIds.size : 0;
}

/**
 * Get memo counts by day for a user
 */
export async function getMemoCountsByDay(userId: string, days: number = 30): Promise<MemoCountsByDay[]> {
  // Get all memos for user
  const memos = await listMemosByUser(userId, 1000);
  
  // Group by date
  const countsByDate = new Map<string, number>();
  
  for (const memo of memos) {
    const date = memo.created_at.split('T')[0];
    countsByDate.set(date, (countsByDate.get(date) || 0) + 1);
  }
  
  // Convert to array and sort by date
  return Array.from(countsByDate.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Delete a memo
 */
export async function deleteMemo(id: string): Promise<boolean> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    return Memos.delete(id);
  }
  
  // In-memory fallback
  const memo = memoStore.get(id);
  if (!memo) return false;
  
  memoStore.delete(id);
  
  // Remove from user's memo set
  const userMemos = userMemosIndex.get(memo.user_id);
  if (userMemos) {
    userMemos.delete(id);
  }
  
  return true;
}

/**
 * Clear all memos (for testing)
 */
export function clearMemos(): void {
  memoStore.clear();
  userMemosIndex.clear();
}