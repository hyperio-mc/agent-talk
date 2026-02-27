/**
 * Agent Talk SDK - TypeScript Types
 */

// ============================================
// Voice Types
// ============================================

export interface Voice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  description: string;
}

// ============================================
// Memo Types
// ============================================

export interface MemoAudio {
  url: string;
  duration: number;
  format: 'mp3' | 'wav' | 'ogg' | 'webm';
}

export interface MemoVoice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  description: string;
}

export interface Memo {
  id: string;
  text: string;
  voice: MemoVoice;
  audio: MemoAudio;
  createdAt: string;
}

export interface CreateMemoOptions {
  /** Text to convert to speech */
  text: string;
  /** Voice ID (use Voices API to get available voices) */
  voice: string;
}

// ============================================
// API Key Types
// ============================================

export interface ApiKey {
  id: string;
  prefix: string;
  maskedKey: string;
  name: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateApiKeyOptions {
  name?: string;
  test?: boolean;
}

export interface CreateApiKeyResponse {
  id: string;
  key: string;
  prefix: string;
  name: string | null;
  createdAt: string;
}

// ============================================
// Auth Types
// ============================================

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface SignupOptions {
  email: string;
  password: string;
}

export interface SignupResponse {
  success: boolean;
  user: User;
  token: string;
  expiresAt: string;
  apiKey: CreateApiKeyResponse & { warning?: string };
  warning?: string;
}

export interface LoginOptions {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user: User;
  token: string;
  expiresAt: string;
}

// ============================================
// Health Types
// ============================================

export interface HealthResponse {
  status: 'ok' | 'error';
  service: string;
  version: string;
  timestamp: string;
  ttsMode: 'simulation' | 'edge' | 'elevenlabs';
  database: {
    status: 'ok' | 'error';
  };
}

// ============================================
// Error Types
// ============================================

export interface ErrorDetails {
  field?: string;
  reason?: string;
  providedType?: string;
  requestedVoice?: string;
  availableVoices?: string[];
  limit?: number;
  used?: number;
  resetAt?: string;
  requiredTier?: string;
  currentTier?: string;
  operation?: string;
  memoId?: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
}

// ============================================
// Client Configuration
// ============================================

export interface AgentTalkConfig {
  /** API key (required for memo creation) */
  apiKey?: string;
  /** Base URL (default: https://talk.onhyper.io) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

// ============================================
// Error Codes (as const for type safety)
// ============================================

export const ErrorCodes = {
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_VOICE: 'INVALID_VOICE',
  
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  MISSING_API_KEY: 'MISSING_API_KEY',
  INVALID_API_KEY: 'INVALID_API_KEY',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',
  
  // Authorization
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_TIER: 'INSUFFICIENT_TIER',
  REVOKED_KEY: 'REVOKED_KEY',
  
  // Not Found
  NOT_FOUND: 'NOT_FOUND',
  MEMO_NOT_FOUND: 'MEMO_NOT_FOUND',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  DAILY_LIMIT_EXCEEDED: 'DAILY_LIMIT_EXCEEDED',
  MONTHLY_LIMIT_EXCEEDED: 'MONTHLY_LIMIT_EXCEEDED',
  
  // Server Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TTS_SERVICE_ERROR: 'TTS_SERVICE_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  
  // Not Implemented
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  
  // Service Unavailable
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
