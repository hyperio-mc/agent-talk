/**
 * Agent Talk SDK - HTTP Client
 */

import type {
  AgentTalkConfig,
  ErrorResponse,
} from './types.js';
import {
  AgentTalkError,
  createErrorFromResponse,
} from './errors.js';

const DEFAULT_BASE_URL = 'https://talk.onhyper.io';
const DEFAULT_TIMEOUT = 30000;

/**
 * HTTP Client for Agent Talk API
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeout: number;

  constructor(config: AgentTalkConfig = {}) {
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Make a GET request
   */
  async get<T>(path: string, options: { auth?: boolean } = {}): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * Make a POST request
   */
  async post<T>(path: string, body?: unknown, options: { auth?: boolean } = {}): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(path: string, options: { auth?: boolean } = {}): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  /**
   * Make an HTTP request
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: { auth?: boolean } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key authentication if required and available
    if (options.auth !== false && this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle successful response
      if (response.ok) {
        // Handle empty responses
        const text = await response.text();
        if (!text) {
          return {} as T;
        }
        return JSON.parse(text) as T;
      }

      // Handle error response
      await this.handleErrorResponse(response);
      
      // TypeScript needs this, but we'll throw before reaching here
      throw new AgentTalkError('INTERNAL_ERROR' as any, 'Unexpected error', 500);
    } catch (error) {
      clearTimeout(timeoutId);

      // Re-throw our own errors
      if (error instanceof AgentTalkError) {
        throw error;
      }

      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AgentTalkError('INTERNAL_ERROR' as any, 'Request timeout', 408);
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new AgentTalkError('SERVICE_UNAVAILABLE' as any, 'Network error: Unable to connect to Agent Talk API', 503);
      }

      // Re-throw unknown errors
      throw error;
    }
  }

  /**
   * Handle error response from API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorResponse: ErrorResponse;

    try {
      errorResponse = await response.json();
    } catch {
      throw new AgentTalkError('INTERNAL_ERROR' as any, `HTTP ${response.status}: ${response.statusText}`, response.status);
    }

    throw createErrorFromResponse(response.status, errorResponse);
  }
}
