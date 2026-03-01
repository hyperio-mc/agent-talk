/**
 * Users Database Stub
 * 
 * Hybrid implementation that uses HYPR Micro when available,
 * with in-memory fallback for development.
 * 
 * @see task-162-phase3-hypr-micro.md
 */

import { v4 as uuidv4 } from 'uuid';
import { isHyprMode, Users, User as MicroUser } from '../lib/micro-tables.js';

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  tier: string;
  role: string;
  verificationToken?: string;
  resetToken?: string;
  resetTokenExpires?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  tier?: string;
  role?: string;
}

export interface UpdateUserData {
  email?: string;
  passwordHash?: string;
  tier?: string;
  role?: string;
  verificationToken?: string;
  resetToken?: string;
  resetTokenExpires?: string;
}

// In-memory storage for development (fallback)
const userStore = new Map<string, User>();
const userEmailIndex = new Map<string, string>();

/**
 * Convert between HYPR Micro format and legacy format
 */
function toLegacyUser(user: MicroUser): User {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.password_hash,
    tier: user.tier,
    role: user.role,
    verificationToken: user.verification_token,
    resetToken: user.reset_token,
    resetTokenExpires: user.reset_token_expires,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

function toMicroUser(user: User): MicroUser {
  return {
    id: user.id,
    email: user.email,
    password_hash: user.passwordHash,
    tier: user.tier as 'hobby' | 'pro' | 'enterprise',
    role: user.role as 'user' | 'admin',
    verification_token: user.verificationToken,
    reset_token: user.resetToken,
    reset_token_expires: user.resetTokenExpires,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

/**
 * Create a new user
 */
export async function createUser(data: CreateUserData): Promise<User> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const microUser = await Users.create({
      id,
      email: data.email,
      password_hash: data.passwordHash,
      tier: (data.tier || 'hobby') as 'hobby' | 'pro' | 'enterprise',
      role: (data.role || 'user') as 'user' | 'admin',
    });
    
    return toLegacyUser(microUser);
  }
  
  // In-memory fallback for development
  const id = uuidv4();
  const now = new Date().toISOString();
  
  // Check if email exists
  if (userEmailIndex.has(data.email)) {
    throw new Error('Email already exists');
  }
  
  const user: User = {
    id,
    email: data.email,
    passwordHash: data.passwordHash,
    tier: data.tier || 'hobby',
    role: data.role || 'user',
    createdAt: now,
    updatedAt: now,
  };
  
  userStore.set(id, user);
  userEmailIndex.set(data.email, id);
  
  return user;
}

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const user = await Users.findById(id);
    return user ? toLegacyUser(user) : null;
  }
  
  // In-memory fallback
  return userStore.get(id) || null;
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const user = await Users.findByEmail(email);
    return user ? toLegacyUser(user) : null;
  }
  
  // In-memory fallback
  const id = userEmailIndex.get(email);
  if (!id) return null;
  return userStore.get(id) || null;
}

/**
 * Update user
 */
export async function updateUser(id: string, data: UpdateUserData): Promise<User | null> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const updates: Partial<MicroUser> = {};
    if (data.email !== undefined) updates.email = data.email;
    if (data.passwordHash !== undefined) updates.password_hash = data.passwordHash;
    if (data.tier !== undefined) updates.tier = data.tier as 'hobby' | 'pro' | 'enterprise';
    if (data.role !== undefined) updates.role = data.role as 'user' | 'admin';
    if (data.verificationToken !== undefined) updates.verification_token = data.verificationToken;
    if (data.resetToken !== undefined) updates.reset_token = data.resetToken;
    if (data.resetTokenExpires !== undefined) updates.reset_token_expires = data.resetTokenExpires;
    
    const user = await Users.update(id, updates);
    return user ? toLegacyUser(user) : null;
  }
  
  // In-memory fallback
  const user = userStore.get(id);
  if (!user) return null;
  
  const updated: User = {
    ...user,
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  };
  
  // Update email index if email changed
  if (data.email && data.email !== user.email) {
    userEmailIndex.delete(user.email);
    userEmailIndex.set(data.email, id);
  }
  
  userStore.set(id, updated);
  return updated;
}

/**
 * Set password reset token
 */
export async function setPasswordResetToken(
  email: string,
  token: string,
  expiresAt: string
): Promise<boolean> {
  const user = await findUserByEmail(email);
  if (!user) return false;
  
  await updateUser(user.id, {
    resetToken: token,
    resetTokenExpires: expiresAt,
  });
  
  return true;
}

/**
 * Reset password using token
 */
export async function resetPassword(token: string, newPasswordHash: string): Promise<User | null> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    // Need to find user by reset token - query all users
    const allUsers = await Users.list(1000);
    const user = allUsers.find(u => u.reset_token === token);
    
    if (user && user.reset_token_expires && new Date(user.reset_token_expires) > new Date()) {
      const updated = await Users.update(user.id, {
        password_hash: newPasswordHash,
        reset_token: undefined,
        reset_token_expires: undefined,
      });
      return updated ? toLegacyUser(updated) : null;
    }
    return null;
  }
  
  // In-memory fallback
  for (const user of userStore.values()) {
    if (user.resetToken === token) {
      if (user.resetTokenExpires && new Date(user.resetTokenExpires) > new Date()) {
        const updated = await updateUser(user.id, {
          passwordHash: newPasswordHash,
          resetToken: undefined,
          resetTokenExpires: undefined,
        });
        return updated;
      }
    }
  }
  return null;
}

/**
 * Verify email using token
 */
export async function verifyEmail(token: string): Promise<User | null> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const allUsers = await Users.list(1000);
    const user = allUsers.find(u => u.verification_token === token);
    
    if (user) {
      const updated = await Users.update(user.id, { verification_token: undefined });
      return updated ? toLegacyUser(updated) : null;
    }
    return null;
  }
  
  // In-memory fallback
  for (const user of userStore.values()) {
    if (user.verificationToken === token) {
      return updateUser(user.id, { verificationToken: undefined });
    }
  }
  return null;
}

/**
 * Update user tier
 */
export async function updateUserTier(userId: string, tier: string): Promise<User | null> {
  return updateUser(userId, { tier } as UpdateUserData);
}

/**
 * Get all users (admin only)
 */
export async function listUsers(limit: number = 100, offset: number = 0): Promise<User[]> {
  // Use HYPR Micro in production
  if (isHyprMode()) {
    const users = await Users.list(limit, offset);
    return users.map(toLegacyUser);
  }
  
  // In-memory fallback
  return Array.from(userStore.values()).slice(offset, offset + limit);
}

/**
 * Count users
 */
export async function countUsers(): Promise<number> {
  // HYPR Micro doesn't have a direct count method for users without a filter
  // For now, use list and count
  if (isHyprMode()) {
    const users = await Users.list(1000);
    return users.length;
  }
  
  return userStore.size;
}

/**
 * Clear all users (for testing)
 */
export function clearUsers(): void {
  userStore.clear();
  userEmailIndex.clear();
}