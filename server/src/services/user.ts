/**
 * User Service - Authentication business logic
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  User,
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
  setPasswordResetToken,
  resetPassword,
  verifyEmail,
} from '../db/users.js';
import {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from '../errors/index.js';

// Configuration
const BCRYPT_COST = 12; // Minimum cost factor as per requirements
const JWT_EXPIRY = '7d'; // Default 7 days as per requirements

export interface SignUpInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: Omit<User, 'passwordHash' | 'verificationToken' | 'resetToken' | 'resetTokenExpires'>;
  token: string;
  expiresAt: number;
}

export interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Get JWT secret from environment or use default (should be set in production)
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn('⚠️ JWT_SECRET not set, using default (not secure for production!)');
    return 'agent-talk-default-secret-change-in-production';
  }
  return secret;
}

/**
 * Get JWT expiry from environment or use default
 */
function getJwtExpiry(): string {
  return process.env.JWT_EXPIRY || JWT_EXPIRY;
}

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  // Validate password strength
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(user: Pick<User, 'id' | 'email'>): { token: string; expiresAt: number } {
  const secret = getJwtSecret();
  const expiry = getJwtExpiry();
  
  const payload = {
    userId: user.id,
    email: user.email,
  };
  
  // Use the expiresIn option - can be a string like '7d' or number of seconds
  // @ts-ignore - TypeScript strict typing issue with jsonwebtoken
  const token = jwt.sign(payload, secret, { expiresIn: expiry });
  
  // Calculate expiration timestamp
  const decoded = jwt.decode(token) as JwtPayload;
  const expiresAt = decoded.exp * 1000; // Convert to milliseconds
  
  return { token, expiresAt };
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret) as JwtPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Sign up a new user
 */
export async function signUp(input: SignUpInput): Promise<AuthResult> {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(input.email)) {
    throw new ValidationError('Invalid email format');
  }
  
  // Validate password
  if (input.password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long');
  }
  
  // Hash password
  const passwordHash = await hashPassword(input.password);
  
  // Create user
  let user: User;
  try {
    user = await createUser({
      email: input.email,
      passwordHash,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('already exists')) {
      throw new ConflictError('An account with this email already exists');
    }
    throw error;
  }
  
  // Generate token
  const { token, expiresAt } = generateToken(user);
  
  // Return user without sensitive fields
  const { passwordHash: _, verificationToken: __, resetToken: ___, resetTokenExpires: ____, ...safeUser } = user;
  
  return {
    user: safeUser,
    token,
    expiresAt,
  };
}

/**
 * Login user
 */
export async function login(input: LoginInput): Promise<AuthResult> {
  // Find user by email
  const user = await findUserByEmail(input.email);
  
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }
  
  // Verify password
  const isValid = await verifyPassword(input.password, user.passwordHash);
  
  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }
  
  // Generate token
  const { token, expiresAt } = generateToken(user);
  
  // Return user without sensitive fields
  const { passwordHash: _, verificationToken: __, resetToken: ___, resetTokenExpires: ____, ...safeUser } = user;
  
  return {
    user: safeUser,
    token,
    expiresAt,
  };
}

/**
 * Get user by ID
 */
export async function getUser(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
  const user = await findUserById(userId);
  if (!user) return null;
  
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

/**
 * Initiate password reset
 */
export async function initiatePasswordReset(email: string): Promise<{ token: string } | null> {
  const user = await findUserByEmail(email);
  
  if (!user) {
    // Don't reveal whether user exists
    return null;
  }
  
  // Generate reset token
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour
  
  await setPasswordResetToken(email, token, expiresAt);
  
  return { token };
}

/**
 * Complete password reset
 */
export async function completePasswordReset(token: string, newPassword: string): Promise<boolean> {
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  
  const passwordHash = await hashPassword(newPassword);
  const user = await resetPassword(token, passwordHash);
  
  return user !== null;
}

/**
 * Initiate email verification
 */
export async function initiateEmailVerification(userId: string): Promise<string | null> {
  const token = uuidv4();
  const user = await updateUser(userId, { verificationToken: token });
  return user ? token : null;
}

/**
 * Complete email verification
 */
export async function completeEmailVerification(token: string): Promise<boolean> {
  const user = await verifyEmail(token);
  return user !== null;
}

/**
 * Change password (for logged-in user)
 */
export async function changePassword(
  userId: string, 
  currentPassword: string, 
  newPassword: string
): Promise<boolean> {
  const user = await findUserById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }
  
  // Validate new password
  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long');
  }
  
  // Hash and update password
  const passwordHash = await hashPassword(newPassword);
  await updateUser(userId, { });
  
  // Direct update of password hash (bypassing the updateUser function)
  const updatedUser = await findUserById(userId);
  if (updatedUser) {
    updatedUser.passwordHash = passwordHash;
    return true;
  }
  
  return false;
}