/**
 * HYPR Client Library
 * 
 * Helpers for interacting with HYPR platform services:
 * - Storage (file uploads)
 * - Micro (database queries)
 * - Proxy (API calls with secret injection)
 */

// ============================================================================
// Types
// ============================================================================

export interface HyprConfig {
  appSlug: string;
  apiBaseUrl?: string;
}

export interface UploadOptions {
  bucket: string;
  filename: string;
  data: Blob | ArrayBuffer | File;
  contentType?: string;
  public?: boolean;
}

export interface UploadResult {
  id: string;
  url: string;
  filename: string;
  size: number;
  contentType: string;
}

export interface MicroQueryOptions {
  table: string;
  select?: string[];
  where?: Record<string, unknown>;
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export interface MicroInsertOptions {
  table: string;
  data: Record<string, unknown>;
}

export interface MicroUpdateOptions {
  table: string;
  data: Record<string, unknown>;
  where: Record<string, unknown>;
}

export interface ProxyFetchOptions {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: HyprConfig = {
  appSlug: 'talk',
  apiBaseUrl: typeof window !== 'undefined' ? window.location.origin : 'https://talk.onhyper.io'
};

let config: HyprConfig = { ...DEFAULT_CONFIG };

export function configureHypr(newConfig: Partial<HyprConfig>): void {
  config = { ...config, ...newConfig };
}

export function getHyprConfig(): HyprConfig {
  return { ...config };
}

// ============================================================================
// Storage Helpers
// ============================================================================

/**
 * Upload a file to HYPR storage
 */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  const { bucket, filename, data, contentType, public: isPublic = true } = options;
  
  // Determine content type
  const resolvedContentType = contentType || (data instanceof File ? data.type : 'application/octet-stream');
  
  // Create form data
  const formData = new FormData();
  const blob = data instanceof ArrayBuffer 
    ? new Blob([data], { type: resolvedContentType })
    : data instanceof File 
      ? data 
      : new Blob([data as BlobPart], { type: resolvedContentType });
  
  formData.append('file', blob, filename);
  formData.append('bucket', bucket);
  formData.append('public', String(isPublic));
  
  const response = await fetch(`${config.apiBaseUrl}/api/hypr/storage/upload`, {
    method: 'POST',
    headers: {
      'X-App-Slug': config.appSlug,
    },
    body: formData
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get a file URL from HYPR storage
 */
export function getFileUrl(fileId: string, bucket?: string): string {
  const bucketPath = bucket ? `${bucket}/` : '';
  return `${config.apiBaseUrl}/storage/${bucketPath}${fileId}`;
}

/**
 * Delete a file from HYPR storage
 */
export async function deleteFile(fileId: string, bucket?: string): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}/api/hypr/storage/${fileId}`, {
    method: 'DELETE',
    headers: {
      'X-App-Slug': config.appSlug,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ bucket })
  });
  
  if (!response.ok) {
    throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * List files in a bucket
 */
export async function listFiles(bucket: string, options?: { prefix?: string; limit?: number }): Promise<UploadResult[]> {
  const params = new URLSearchParams({ bucket });
  if (options?.prefix) params.set('prefix', options.prefix);
  if (options?.limit) params.set('limit', String(options.limit));
  
  const response = await fetch(`${config.apiBaseUrl}/api/hypr/storage?${params}`, {
    headers: {
      'X-App-Slug': config.appSlug
    }
  });
  
  if (!response.ok) {
    throw new Error(`List failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// Micro Query Helpers (Placeholder)
// ============================================================================

/**
 * Query HYPR Micro tables
 * 
 * Note: This is a placeholder. The actual implementation will depend on
 * the HYPR Micro API when it becomes available.
 */
export async function microQuery(options: MicroQueryOptions): Promise<unknown[]> {
  const { table, select, where, orderBy, limit, offset } = options;
  
  const params = new URLSearchParams();
  if (select) params.set('select', select.join(','));
  if (orderBy) params.set('orderBy', orderBy);
  if (limit) params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));
  
  const response = await fetch(`${config.apiBaseUrl}/api/hypr/micro/${table}?${params}`, {
    method: 'POST',
    headers: {
      'X-App-Slug': config.appSlug,
      'Content-Type': 'application/json'
    },
    body: where ? JSON.stringify({ where }) : undefined
  });
  
  if (!response.ok) {
    throw new Error(`Query failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Insert into HYPR Micro table
 */
export async function microInsert(options: MicroInsertOptions): Promise<{ id: string }> {
  const { table, data } = options;
  
  const response = await fetch(`${config.apiBaseUrl}/api/hypr/micro/${table}`, {
    method: 'POST',
    headers: {
      'X-App-Slug': config.appSlug,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error(`Insert failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Update HYPR Micro table
 */
export async function microUpdate(options: MicroUpdateOptions): Promise<{ affected: number }> {
  const { table, data, where } = options;
  
  const response = await fetch(`${config.apiBaseUrl}/api/hypr/micro/${table}`, {
    method: 'PATCH',
    headers: {
      'X-App-Slug': config.appSlug,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ data, where })
  });
  
  if (!response.ok) {
    throw new Error(`Update failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Delete from HYPR Micro table
 */
export async function microDelete(table: string, where: Record<string, unknown>): Promise<{ affected: number }> {
  const response = await fetch(`${config.apiBaseUrl}/api/hypr/micro/${table}`, {
    method: 'DELETE',
    headers: {
      'X-App-Slug': config.appSlug,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ where })
  });
  
  if (!response.ok) {
    throw new Error(`Delete failed: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// Proxy Fetch Wrapper
// ============================================================================

/**
 * Make API calls through HYPR proxy with automatic secret injection
 * 
 * Example:
 *   // Instead of calling ElevenLabs directly:
 *   fetch('https://api.elevenlabs.io/v1/text-to-speech/voice-id', {
 *     headers: { 'xi-api-key': ELEVENLABS_API_KEY }
 *   })
 *   
 *   // Use the proxy:
 *   proxyFetch({
 *     path: '/elevenlabs/v1/text-to-speech/voice-id',
 *     method: 'POST',
 *     body: { text: 'Hello', voice: 'rachel' }
 *   })
 */
export async function proxyFetch<T = unknown>(options: ProxyFetchOptions): Promise<T> {
  const { path, method = 'GET', body, headers = {} } = options;
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  const response = await fetch(`${config.apiBaseUrl}/api/v1/proxy${normalizedPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-App-Slug': config.appSlug,
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Proxy request failed: ${response.status} ${response.statusText}\n${errorText}`);
  }
  
  // Check if response is JSON
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  
  // Return raw response for non-JSON (e.g., audio)
  return response as unknown as T;
}

/**
 * Proxy fetch specifically for ElevenLabs TTS
 * Automatically handles audio responses
 */
export async function proxyElevenLabsTTS(
  voiceId: string,
  text: string,
  options?: { modelId?: string; stability?: number; similarityBoost?: number }
): Promise<ArrayBuffer> {
  const response = await fetch(`${config.apiBaseUrl}/api/v1/elevenlabs/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Slug': config.appSlug
    },
    body: JSON.stringify({
      text,
      model_id: options?.modelId || 'eleven_monolingual_v1',
      voice_settings: {
        stability: options?.stability ?? 0.5,
        similarity_boost: options?.similarityBoost ?? 0.75
      }
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs TTS failed: ${response.status}\n${errorText}`);
  }
  
  return response.arrayBuffer();
}

// ============================================================================
// Auth Helpers (Future)
// ============================================================================

/**
 * Get current user from HYPR Auth
 * Placeholder for future WorkOS/HYPR auth integration
 */
export async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
  const response = await fetch(`${config.apiBaseUrl}/api/hypr/auth/me`, {
    headers: {
      'X-App-Slug': config.appSlug
    }
  });
  
  if (response.status === 401) {
    return null;
  }
  
  if (!response.ok) {
    throw new Error(`Auth check failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Initiate HYPR Auth login flow
 */
export function getLoginUrl(returnTo?: string): string {
  const params = new URLSearchParams();
  if (returnTo) params.set('return_to', returnTo);
  return `${config.apiBaseUrl}/api/hypr/auth/login?${params}`;
}

/**
 * Initiate logout
 */
export function getLogoutUrl(): string {
  return `${config.apiBaseUrl}/api/hypr/auth/logout`;
}

// ============================================================================
// Default Export
// ============================================================================

const Hypr = {
  configure: configureHypr,
  getConfig: getHyprConfig,
  
  // Storage
  upload: uploadFile,
  getUrl: getFileUrl,
  delete: deleteFile,
  list: listFiles,
  
  // Micro
  query: microQuery,
  insert: microInsert,
  update: microUpdate,
  delete: microDelete,
  
  // Proxy
  fetch: proxyFetch,
  elevenLabs: proxyElevenLabsTTS,
  
  // Auth
  user: getCurrentUser,
  loginUrl: getLoginUrl,
  logoutUrl: getLogoutUrl
};

export default Hypr;