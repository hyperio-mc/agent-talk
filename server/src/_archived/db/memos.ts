/**
 * Memo Database Operations
 * SQLite implementation for memo storage and retrieval
 */

import { getDb } from './index.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreateMemoInput {
  userId: string;
  apiKeyId: string | null;
  text: string;
  voice: string;
  audioUrl: string;
  durationSeconds?: number;
  characterCount: number;
}

export interface MemoRecord {
  id: string;
  user_id: string;
  api_key_id: string | null;
  text: string;
  voice: string;
  audio_url: string;
  duration_seconds: number | null;
  character_count: number;
  created_at: string;
}

export interface MemoStats {
  totalCount: number;
  totalCharacters: number;
  uniqueVoices: number;
}

/**
 * Create a new memo record
 */
export function createMemo(input: CreateMemoInput): MemoRecord {
  const db = getDb();
  
  const id = `memo_${uuidv4().replace(/-/g, '').slice(0, 20)}`;
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO memos (id, user_id, api_key_id, text, voice, audio_url, duration_seconds, character_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    input.userId,
    input.apiKeyId,
    input.text,
    input.voice,
    input.audioUrl,
    input.durationSeconds || null,
    input.characterCount,
    now
  );
  
  return {
    id,
    user_id: input.userId,
    api_key_id: input.apiKeyId,
    text: input.text,
    voice: input.voice,
    audio_url: input.audioUrl,
    duration_seconds: input.durationSeconds || null,
    character_count: input.characterCount,
    created_at: now,
  };
}

/**
 * Get memo by ID
 */
export function getMemoById(id: string): MemoRecord | null {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT id, user_id, api_key_id, text, voice, audio_url, duration_seconds, character_count, created_at
    FROM memos
    WHERE id = ?
  `);
  
  const row = stmt.get(id) as MemoRecord | undefined;
  return row || null;
}

/**
 * List memos for a user
 */
export function listMemosByUser(userId: string, limit: number = 50): MemoRecord[] {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT id, user_id, api_key_id, text, voice, audio_url, duration_seconds, character_count, created_at
    FROM memos
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  
  return stmt.all(userId, limit) as MemoRecord[];
}

/**
 * Get memo stats for a user
 */
export function getMemoStats(userId: string): MemoStats {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as totalCount,
      COALESCE(SUM(character_count), 0) as totalCharacters,
      COUNT(DISTINCT voice) as uniqueVoices
    FROM memos
    WHERE user_id = ?
  `);
  
  const result = stmt.get(userId) as { totalCount: number; totalCharacters: number; uniqueVoices: number };
  
  return {
    totalCount: result.totalCount || 0,
    totalCharacters: result.totalCharacters || 0,
    uniqueVoices: result.uniqueVoices || 0,
  };
}

/**
 * Count memos for a user in a time range
 */
export function countMemosByUserSince(userId: string, since: Date): number {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM memos
    WHERE user_id = ? AND created_at >= ?
  `);
  
  const result = stmt.get(userId, since.toISOString()) as { count: number };
  return result.count || 0;
}

/**
 * Delete memos for a user (for testing/cleanup)
 */
export function deleteMemosByUser(userId: string): number {
  const db = getDb();
  
  const result = db.prepare('DELETE FROM memos WHERE user_id = ?').run(userId);
  return result.changes;
}

/**
 * Get memo counts by day for a user
 */
export function getMemoCountsByDay(userId: string, days: number = 30): Array<{ date: string; count: number; characters: number }> {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT 
      date(created_at) as date,
      COUNT(*) as count,
      COALESCE(SUM(character_count), 0) as characters
    FROM memos
    WHERE user_id = ? AND created_at >= datetime('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY date DESC
  `);
  
  return stmt.all(userId, days) as Array<{ date: string; count: number; characters: number }>;
}

/**
 * Get voice usage counts for a user
 */
export function getVoiceUsageCounts(userId: string): Array<{ voice: string; count: number }> {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT voice, COUNT(*) as count
    FROM memos
    WHERE user_id = ?
    GROUP BY voice
    ORDER BY count DESC
  `);
  
  return stmt.all(userId) as Array<{ voice: string; count: number }>;
}