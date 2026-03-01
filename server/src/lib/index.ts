/**
 * HYPR Client Library - Server-side
 * 
 * Utilities for interacting with HYPR platform services:
 * - Proxy: External API calls with secret injection
 * - Micro: Database operations
 * - Storage: File storage
 * 
 * @see HYPR-REFACTOR-PLAN.md
 */

// Configuration
export { getHyprConfig, getHyprHeaders, HYPR_ENDPOINTS } from './hypr-config.js';
export type { HyprConfig } from './hypr-config.js';

// Proxy client
export { 
  HyprProxyClient, 
  getProxyClient, 
  initProxyClient 
} from './hypr-proxy.js';
export type { 
  ProxyRequestOptions, 
  ProxyResponse, 
  ElevenLabsTTSOptions, 
  ElevenLabsVoice 
} from './hypr-proxy.js';

// Micro client
export { 
  HyprMicroClient, 
  getMicroClient, 
  initMicroClient 
} from './hypr-micro.js';
export type { 
  MicroDocument, 
  MicroQueryOptions, 
  MicroWhereClause, 
  MicroListResponse 
} from './hypr-micro.js';

// Storage client
export { 
  HyprStorageClient, 
  getStorageClient, 
  initStorageClient 
} from './hypr-storage.js';
export type { 
  StorageUploadOptions, 
  StorageFile, 
  StorageListOptions 
} from './hypr-storage.js';

// Micro tables (typed database helpers)
export {
  TABLES,
  isHyprMode,
  initMicroTables,
  Users,
  ApiKeys,
  Memos,
  UsageLogs,
  Subscriptions,
} from './micro-tables.js';
export type {
  User as MicroUser,
  ApiKey as MicroApiKey,
  Memo as MicroMemo,
  UsageLog as MicroUsageLog,
  Subscription as MicroSubscription,
} from './micro-tables.js';