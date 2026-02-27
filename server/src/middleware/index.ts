/**
 * Middleware Exports
 */

export { errorHandler, notFoundHandler, asyncHandler, validate, requireField, validateType } from './errorHandler.js';
export { requestLogger, getRequestLogger, getRequestContext, logRequestDetail, logRequestBody, Timer } from './requestLogger.js';
export { requireAuth, optionalAuth, getAuthUser, getAuthCookieOptions, getClearCookieOptions } from './auth.js';
export type { AuthContext } from './auth.js';
export { requireAdmin, isAdmin } from './admin.js';
export { rateLimitMiddleware, simpleRateLimit, getRateLimitStatus } from './rateLimit.js';

export type { ErrorHandlerOptions } from './errorHandler.js';
export type { RequestLoggerOptions, RequestContext } from './requestLogger.js';

// Tier check middleware
export {
  loadTierInfo,
  getTierInfo,
  getUserTier,
  requireTier,
  requireTTSAccess,
  validateCharacterLimit,
  checkMemoLength,
  hasVoiceCloningAccess,
  hasPriorityAccess,
  hasWebhookAccess,
  getEffectiveTTSMode,
  requireVoiceCloning,
  getTierFeatureHeaders,
} from './tierCheck.js';