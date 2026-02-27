/**
 * Users Database - HYPR Micro Implementation
 * 
 * Manages user records in HYPR Micro with in-memory fallback.
 * 
 * @see HYPR-REFACTOR-PLAN.md Phase 3
 */

import { getMicroClient } from '../lib/hypr-micro.js';
import { isHyprMode, DB_NAMES } from './index.js';
import { logger } from '../utils/logger.js';

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  tier: 'hobby' | 'pro' | 'enterprise';
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
  emailVerified?: boolean;
  verificationToken?: string;
  resetToken?: string;
  resetTokenExpires?: string;
  [key: string]: unknown; // Index signature for HYPR Micro compatibility
}

// Alias for compatibility
export type { User as UserRecord };

export interface CreateUserInput {
  email: string;
  passwordHash?: string;
  tier?: 'hobby' | 'pro' | 'enterprise';
  role?: 'user' | 'admin';
}

export interface UpdateUserInput {
  email?: string;
  tier?: 'hobby' | 'pro' | 'enterprise';
  role?: 'user' | 'admin';
  passwordHash?: string;
  verificationToken?: string;
  resetToken?: string;
  resetTokenExpires?: string;
  emailVerified?: boolean;
}

// In-memory fallback storage
const memoryUsers = new Map<string, User>();
const emailIndex = new Map<string, string>();

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  if (isHyprMode()) {
    try {
      const user = await getMicroClient().get<User>(DB_NAMES.USERS, id);
      return user;
    } catch (error: unknown) {
      logger.error('Failed to find user by ID in HYPR Micro', { id, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return null;
    }
  }
  
  return memoryUsers.get(id) || null;
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase();
  
  if (isHyprMode()) {
    try {
      const users = await getMicroClient().query<User>(DB_NAMES.USERS, { email: normalizedEmail });
      return users[0] || null;
    } catch (error: unknown) {
      logger.error('Failed to find user by email in HYPR Micro', { email: normalizedEmail, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return null;
    }
  }
  
  const id = emailIndex.get(normalizedEmail);
  if (!id) return null;
  return memoryUsers.get(id) || null;
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const normalizedEmail = input.email.toLowerCase();
  
  // Check if user already exists
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error('User with this email already exists');
  }
  
  const id = generateId();
  const now = new Date().toISOString();
  
  const user: User = {
    id,
    email: normalizedEmail,
    passwordHash: input.passwordHash,
    tier: input.tier || 'hobby',
    role: input.role || 'user',
    createdAt: now,
    updatedAt: now,
    emailVerified: false,
  };

  if (isHyprMode()) {
    try {
      await getMicroClient().insert(DB_NAMES.USERS, user);
      logger.debug('User created in HYPR Micro', { id, email: user.email });
    } catch (error: unknown) {
      logger.error('Failed to create user in HYPR Micro', { error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      throw error;
    }
  } else {
    memoryUsers.set(id, user);
    emailIndex.set(normalizedEmail, id);
    logger.debug('User created in memory', { id, email: user.email });
  }

  return user;
}

/**
 * Update a user
 */
export async function updateUser(id: string, data: UpdateUserInput): Promise<User | null> {
  if (isHyprMode()) {
    try {
      const updated = await getMicroClient().update<User>(DB_NAMES.USERS, id, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      return updated;
    } catch (error: unknown) {
      logger.error('Failed to update user in HYPR Micro', { id, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return null;
    }
  }
  
  const user = memoryUsers.get(id);
  if (!user) return null;
  
  // Update email index if email changed
  if (data.email && data.email !== user.email) {
    emailIndex.delete(user.email);
    emailIndex.set(data.email.toLowerCase(), id);
  }
  
  const updated: User = { 
    ...user, 
    ...data, 
    updatedAt: new Date().toISOString() 
  };
  memoryUsers.set(id, updated);
  
  return updated;
}

/**
 * Get all users
 */
export async function getAllUsers(): Promise<User[]> {
  if (isHyprMode()) {
    try {
      const { docs } = await getMicroClient().list<User>(DB_NAMES.USERS);
      return docs;
    } catch (error: unknown) {
      logger.error('Failed to get all users from HYPR Micro', { error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return [];
    }
  }
  
  return Array.from(memoryUsers.values());
}

/**
 * Update user tier
 */
export async function updateUserTier(userId: string, tier: 'hobby' | 'pro' | 'enterprise'): Promise<void> {
  if (isHyprMode()) {
    try {
      await getMicroClient().update(DB_NAMES.USERS, userId, { tier, updatedAt: new Date().toISOString() });
      logger.debug('User tier updated in HYPR Micro', { userId, tier });
    } catch (error: unknown) {
      logger.error('Failed to update user tier in HYPR Micro', { userId, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      throw error;
    }
    return;
  }
  
  const user = memoryUsers.get(userId);
  if (user) {
    user.tier = tier;
    user.updatedAt = new Date().toISOString();
    memoryUsers.set(userId, user);
    logger.debug('User tier updated in memory', { userId, tier });
  }
}

/**
 * Set password reset token for a user
 */
export async function setPasswordResetToken(email: string, token: string, expiresAt: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase();
  
  if (isHyprMode()) {
    try {
      const users = await getMicroClient().query<User>(DB_NAMES.USERS, { email: normalizedEmail });
      if (users.length === 0) return false;
      
      await getMicroClient().update(DB_NAMES.USERS, users[0].id, {
        resetToken: token,
        resetTokenExpires: expiresAt,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (error: unknown) {
      logger.error('Failed to set password reset token in HYPR Micro', { email: normalizedEmail, error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return false;
    }
  }
  
  const id = emailIndex.get(normalizedEmail);
  if (!id) return false;
  
  const user = memoryUsers.get(id);
  if (!user) return false;
  
  user.resetToken = token;
  user.resetTokenExpires = expiresAt;
  user.updatedAt = new Date().toISOString();
  
  return true;
}

/**
 * Reset password using token
 */
export async function resetPassword(token: string, newPasswordHash: string): Promise<User | null> {
  const now = new Date().toISOString();
  
  if (isHyprMode()) {
    try {
      const users = await getMicroClient().query<User>(DB_NAMES.USERS, { resetToken: token });
      if (users.length === 0) return null;
      
      const user = users[0];
      
      // Check if token is expired
      if (user.resetTokenExpires && new Date(user.resetTokenExpires) < new Date()) {
        return null;
      }
      
      const updated = await getMicroClient().update<User>(DB_NAMES.USERS, user.id, {
        passwordHash: newPasswordHash,
        resetToken: undefined,
        resetTokenExpires: undefined,
        updatedAt: now,
      } as Partial<User>);
      
      return updated;
    } catch (error: unknown) {
      logger.error('Failed to reset password in HYPR Micro', { error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return null;
    }
  }
  
  // Find user by reset token
  for (const user of memoryUsers.values()) {
    if (user.resetToken === token) {
      // Check if token is expired
      if (user.resetTokenExpires && new Date(user.resetTokenExpires) < new Date()) {
        return null;
      }
      
      user.passwordHash = newPasswordHash;
      user.resetToken = undefined;
      user.resetTokenExpires = undefined;
      user.updatedAt = now;
      
      return user;
    }
  }
  
  return null;
}

/**
 * Verify email using token
 */
export async function verifyEmail(token: string): Promise<User | null> {
  const now = new Date().toISOString();
  
  if (isHyprMode()) {
    try {
      const users = await getMicroClient().query<User>(DB_NAMES.USERS, { verificationToken: token });
      if (users.length === 0) return null;
      
      const user = users[0];
      const updated = await getMicroClient().update<User>(DB_NAMES.USERS, user.id, {
        emailVerified: true,
        verificationToken: undefined,
        updatedAt: now,
      } as Partial<User>);
      
      return updated;
    } catch (error: unknown) {
      logger.error('Failed to verify email in HYPR Micro', { error: { name: 'HyprMicroError', message: error instanceof Error ? error.message : String(error) } });
      return null;
    }
  }
  
  // Find user by verification token
  for (const user of memoryUsers.values()) {
    if (user.verificationToken === token) {
      user.emailVerified = true;
      user.verificationToken = undefined;
      user.updatedAt = now;
      
      return user;
    }
  }
  
  return null;
}

/**
 * Generate unique ID
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `user_${timestamp}_${random}`;
}

/**
 * Reset in-memory storage (for testing only)
 */
export function _resetUsers(): void {
  if (!isHyprMode()) {
    memoryUsers.clear();
    emailIndex.clear();
  }
}