/**
 * Agent Talk SDK
 * 
 * TypeScript SDK for the Agent Talk API - Text-to-speech for AI agents
 * 
 * @packageDocumentation
 */

import { HttpClient } from './client.js';
import { MemoApi } from './memo.js';
import { VoicesApi } from './voices.js';
import type {
  AgentTalkConfig,
  HealthResponse,
} from './types.js';

// Export all types
export type {
  Voice,
  Memo,
  MemoAudio,
  MemoVoice,
  CreateMemoOptions,
  ApiKey,
  CreateApiKeyOptions,
  CreateApiKeyResponse,
  User,
  SignupOptions,
  SignupResponse,
  LoginOptions,
  LoginResponse,
  HealthResponse,
  ErrorDetails,
  ErrorResponse,
  AgentTalkConfig,
  ErrorCode,
} from './types.js';

// Export all errors
export {
  AgentTalkError,
  ValidationError,
  InvalidInputError,
  MissingFieldError,
  InvalidVoiceError,
  UnauthorizedError,
  MissingApiKeyError,
  InvalidApiKeyError,
  ExpiredTokenError,
  ForbiddenError,
  InsufficientTierError,
  RevokedKeyError,
  NotFoundError,
  MemoNotFoundError,
  RateLimitError,
  DailyLimitExceededError,
  MonthlyLimitExceededError,
  InternalError,
  TTSServiceError,
  StorageError,
  NotImplementedError,
  ServiceUnavailableError,
} from './errors.js';

// Export error codes
export { ErrorCodes } from './types.js';

/**
 * Agent Talk SDK Client
 * 
 * Main entry point for interacting with the Agent Talk API.
 * 
 * @example Basic usage
 * ```typescript
 * import { AgentTalk } from '@hyperio/agent-talk';
 * 
 * const client = new AgentTalk({
 *   apiKey: 'at_live_xxx'
 * });
 * 
 * // Create a memo
 * const memo = await client.memo.create({
 *   text: "Hello world",
 *   voice: "rachel"
 * });
 * 
 * // Play audio in browser
 * const audio = new Audio(memo.audio.url);
 * audio.play();
 * ```
 * 
 * @example Without API key (demo mode)
 * ```typescript
 * const client = new AgentTalk();
 * 
 * // List voices (no auth required)
 * const voices = await client.voices.list();
 * 
 * // Create demo memo (simulated audio)
 * const memo = await client.memo.demo({
 *   text: "This is a demo",
 *   voice: "rachel"
 * });
 * ```
 */
export class AgentTalk {
  private readonly httpClient: HttpClient;
  
  /** Memo API - Create text-to-speech memos */
  public readonly memo: MemoApi;
  
  /** Voices API - List available voices */
  public readonly voices: VoicesApi;

  /**
   * Create a new Agent Talk client
   * 
   * @param config - Client configuration
   * @param config.apiKey - API key (required for memo.create(), optional for demo/voices)
   * @param config.baseUrl - API base URL (default: https://talk.onhyper.io)
   * @param config.timeout - Request timeout in ms (default: 30000)
   */
  constructor(config: AgentTalkConfig = {}) {
    this.httpClient = new HttpClient(config);
    this.memo = new MemoApi(this.httpClient);
    this.voices = new VoicesApi(this.httpClient);
  }

  /**
   * Check API health status
   * 
   * @returns Health status response
   * 
   * @example
   * const health = await client.health();
   * console.log(health.status); // 'ok' or 'error'
   */
  async health(): Promise<HealthResponse> {
    return this.httpClient.get<HealthResponse>('/health');
  }

  /**
   * Get the base URL being used
   * 
   * @returns The API base URL
   */
  getBaseUrl(): string {
    return this.httpClient.getBaseUrl();
  }
}

// Default export
export default AgentTalk;
