/**
 * Authentication Middleware - STUB
 * 
 * This is a placeholder until HYPR auth is integrated.
 * All protected routes will fail with 503 Service Unavailable.
 * 
 * TODO: Replace with HYPR authentication when available.
 */

import { Context, Next } from 'hono';
import { NotImplementedError } from '../errors/index.js';

// Auth context type (for future HYPR integration)
export interface AuthContext {
  userId: string;
  email: string;
  tier: string;
  role: string;
}

// Extended user context with full user data
export interface UserContext extends AuthContext {
  user: unknown;
}

// Add user to Hono's context variables
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthContext;
    fullUser: unknown;
  }
}

/**
 * Require authentication middleware - STUB
 * 
 * Currently returns 503 until HYPR auth is integrated.
 */
export async function requireAuth(c: Context, next: Next) {
  throw new NotImplementedError('Authentication not configured. HYPR auth integration pending.');
}

/**
 * Optional authentication middleware - STUB
 * 
 * Currently does nothing until HYPR auth is integrated.
 */
export async function optionalAuth(c: Context, next: Next) {
  // No user context until HYPR auth
  await next();
}

/**
 * Get authenticated user from context - STUB
 */
export function getAuthUser(c: Context): AuthContext | null {
  return null;
}

/**
 * Get full user object from context - STUB
 */
export function getFullUser(c: Context): unknown {
  return null;
}

/**
 * Require admin role middleware - STUB
 */
export async function requireAdmin(c: Context, next: Next) {
  throw new NotImplementedError('Authentication not configured. HYPR auth integration pending.');
}

/**
 * Cookie options for session cookies - STUB
 */
export function getAuthCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  };
}

export function getClearCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  };
}

export const SESSION_COOKIE_NAME = 'auth_token';