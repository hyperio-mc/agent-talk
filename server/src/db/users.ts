/**
 * User Database Operations
 * SQLite implementation backed by the main database
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from './index.js';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  tier: 'hobby' | 'pro' | 'enterprise';
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
  emailVerified: boolean;
  verificationToken?: string;
  resetToken?: string;
  resetTokenExpires?: string;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  tier?: 'hobby' | 'pro' | 'enterprise';
  role?: 'user' | 'admin';
}

export interface UpdateUserInput {
  email?: string;
  passwordHash?: string;
  tier?: string;
  role?: string;
  emailVerified?: boolean;
  verificationToken?: string | undefined;
  resetToken?: string | undefined;
  resetTokenExpires?: string | undefined;
}

/**
 * Create a new user in SQLite database
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  const db = getDb();
  
  // Check if email already exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email.toLowerCase());
  if (existing) {
    throw new Error('User with this email already exists');
  }

  const id = `user_${uuidv4().replace(/-/g, '').slice(0, 20)}`;
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO users (id, email, password_hash, tier, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.email.toLowerCase(),
    input.passwordHash,
    input.tier || 'hobby',
    input.role || 'user',
    now,
    now
  );

  return {
    id,
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    tier: input.tier || 'hobby',
    role: input.role || 'user',
    createdAt: now,
    updatedAt: now,
    emailVerified: false,
  };
}

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    tier: row.tier,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    emailVerified: false, // Not tracked in SQLite yet
  };
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    tier: row.tier,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    emailVerified: false,
  };
}

/**
 * Update user
 */
export async function updateUser(id: string, input: UpdateUserInput): Promise<User | null> {
  const user = await findUserById(id);
  if (!user) return null;

  const now = new Date().toISOString();
  const db = getDb();
  
  // Build update query dynamically
  const updates: string[] = ['updated_at = ?'];
  const values: any[] = [now];
  
  if (input.email !== undefined) {
    updates.push('email = ?');
    values.push(input.email.toLowerCase());
  }
  if (input.passwordHash !== undefined) {
    updates.push('password_hash = ?');
    values.push(input.passwordHash);
  }
  if (input.tier !== undefined) {
    updates.push('tier = ?');
    values.push(input.tier);
  }
  if (input.role !== undefined) {
    updates.push('role = ?');
    values.push(input.role);
  }
  
  values.push(id);
  
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  
  return {
    ...user,
    ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
    ...(input.passwordHash !== undefined ? { passwordHash: input.passwordHash } : {}),
    ...(input.tier !== undefined ? { tier: input.tier as User['tier'] } : {}),
    ...(input.role !== undefined ? { role: input.role as User['role'] } : {}),
    updatedAt: now,
  };
}

/**
 * Delete user
 */
export async function deleteUser(id: string): Promise<boolean> {
  const db = getDb();
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Get all users (for debugging/testing)
 */
export async function getAllUsers(): Promise<Omit<User, 'passwordHash'>[]> {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM users').all() as any[];
  
  return rows.map(row => ({
    id: row.id,
    email: row.email,
    tier: row.tier,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    emailVerified: false,
  }));
}

/**
 * Clear all users (for testing)
 */
export async function clearUsers(): Promise<void> {
  const db = getDb();
  db.prepare('DELETE FROM api_keys').run();
  db.prepare('DELETE FROM users').run();
}

/**
 * Set verification token
 */
export async function setVerificationToken(userId: string, token: string): Promise<User | null> {
  return updateUser(userId, { verificationToken: token });
}

/**
 * Verify email
 */
export async function verifyEmail(token: string): Promise<User | null> {
  // For SQLite implementation, we'd need a separate table for verification tokens
  // For now, return null (not implemented)
  return null;
}

/**
 * Set password reset token
 */
export async function setPasswordResetToken(
  email: string, 
  token: string, 
  expiresAt: string
): Promise<User | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  
  return updateUser(user.id, { 
    resetToken: token, 
    resetTokenExpires: expiresAt 
  });
}

/**
 * Reset password using token
 */
export async function resetPassword(token: string, newPasswordHash: string): Promise<User | null> {
  // For SQLite implementation, we'd need to store and check tokens
  // For now, return null (not implemented)
  return null;
}

/**
 * Update password directly
 */
export async function updatePassword(userId: string, newPasswordHash: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(newPasswordHash, now, userId);
  return result.changes > 0;
}

/**
 * Update user tier
 */
export async function updateUserTier(
  userId: string, 
  tier: 'hobby' | 'pro' | 'enterprise'
): Promise<User | null> {
  const user = await findUserById(userId);
  if (!user) return null;
  
  const db = getDb();
  const now = new Date().toISOString();
  
  const result = db.prepare('UPDATE users SET tier = ?, updated_at = ? WHERE id = ?')
    .run(tier, now, userId);
  
  if (result.changes === 0) {
    return null;
  }
  
  return {
    ...user,
    tier,
    updatedAt: now,
  };
}
