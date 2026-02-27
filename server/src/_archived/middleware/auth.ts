/**
 * Authentication Middleware
 * Validates JWT tokens and adds user context to requests
 */

import { Context, Next } from 'hono';
import { verifyToken, extractBearerToken } from '../services/user.js';
import { 
  UnauthorizedError, 
  MissingApiKeyError, 
  InvalidApiKeyError 
} from '../errors/index.js';

// Extend Hono's context with user info
export interface AuthContext {
  userId: string;
  email: string;
}

// Add user to context variables
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthContext;
  }
}

/**
 * Middleware to require authentication
 * Sets c.var.user if authenticated, throws 401 if not
 */
export async function requireAuth(c: Context, next: Next) {
  // Try to get token from Authorization header
  const authHeader = c.req.header('Authorization');
  let token = extractBearerToken(authHeader);
  
  // Also check cookie as fallback
  if (!token) {
    const cookieHeader = c.req.header('Cookie');
    if (cookieHeader) {
      const cookies = parseCookies(cookieHeader);
      token = cookies['auth_token'] || null;
    }
  }
  
  if (!token) {
    throw new MissingApiKeyError();
  }
  
  const payload = verifyToken(token);
  
  if (!payload) {
    throw new InvalidApiKeyError();
  }
  
  // Add user info to context
  c.set('user', {
    userId: payload.userId,
    email: payload.email,
  });
  
  await next();
}

/**
 * Optional authentication middleware
 * Sets c.var.user if authenticated, but doesn't require it
 */
export async function optionalAuth(c: Context, next: Next) {
  // Try to get token from Authorization header
  const authHeader = c.req.header('Authorization');
  let token = extractBearerToken(authHeader);
  
  // Also check cookie as fallback
  if (!token) {
    const cookieHeader = c.req.header('Cookie');
    if (cookieHeader) {
      const cookies = parseCookies(cookieHeader);
      token = cookies['auth_token'] || null;
    }
  }
  
  if (token) {
    const payload = verifyToken(token);
    
    if (payload) {
      c.set('user', {
        userId: payload.userId,
        email: payload.email,
      });
    }
  }
  
  await next();
}

/**
 * Get authenticated user from context
 */
export function getAuthUser(c: Context): AuthContext | null {
  return c.get('user') || null;
}

/**
 * Parse cookies from header
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name && valueParts.length > 0) {
      cookies[name.trim()] = decodeURIComponent(valueParts.join('='));
    }
  });
  
  return cookies;
}

/**
 * Create cookie options for auth token
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
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  };
}

/**
 * Create clear cookie options for logout
 */
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
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  };
}