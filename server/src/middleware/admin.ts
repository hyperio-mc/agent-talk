/**
 * Admin Middleware
 * Checks for admin role on authenticated users
 */

import { Context, Next } from 'hono';
import { getAuthUser } from './auth.js';
import { ForbiddenError, UnauthorizedError } from '../errors/index.js';
import { getDb } from '../db/index.js';

/**
 * Middleware to require admin role
 * Should be used after requireAuth middleware, or standalone to check both auth and admin
 */
export async function requireAdmin(c: Context, next: Next) {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  // Check if user has admin role
  const db = getDb();
  const user = db.prepare(
    'SELECT role FROM users WHERE id = ?'
  ).get(authUser.userId) as { role: string } | undefined;
  
  if (!user || user.role !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  
  await next();
}

/**
 * Check if a user is an admin
 */
export function isAdmin(userId: string): boolean {
  const db = getDb();
  const user = db.prepare(
    'SELECT role FROM users WHERE id = ?'
  ).get(userId) as { role: string } | undefined;
  
  return user?.role === 'admin';
}
