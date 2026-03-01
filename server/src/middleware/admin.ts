/**
 * Admin Middleware
 * Checks for admin role on authenticated users
 */

import { Context, Next } from 'hono';
import { getAuthUser } from './auth.js';
import { ForbiddenError, UnauthorizedError } from '../errors/index.js';
import { findUserById } from '../db-stub/users.js';

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
  const user = await findUserById(authUser.userId);
  
  if (!user || user.role !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  
  await next();
}

/**
 * Check if a user is an admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const user = await findUserById(userId);
  return user?.role === 'admin';
}