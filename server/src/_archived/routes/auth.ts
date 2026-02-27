/**
 * Authentication Routes
 */

import { Hono } from 'hono';
import { 
  signUp, 
  login, 
  getUser, 
  initiatePasswordReset, 
  completePasswordReset,
  initiateEmailVerification,
  completeEmailVerification,
  changePassword 
} from '../services/user.js';
import { 
  createNewApiKey
} from '../services/apiKey.js';
import { 
  requireAuth, 
  getAuthUser, 
  getAuthCookieOptions, 
  getClearCookieOptions 
} from '../middleware/auth.js';
import { 
  ValidationError, 
  MissingFieldError, 
  UnauthorizedError,
  NotFoundError,
  InternalError
} from '../errors/index.js';

export const authRoutes = new Hono();

/**
 * POST /api/v1/auth/signup
 * Create a new user account
 */
authRoutes.post('/signup', async (c) => {
  // Parse and validate request body
  let body: { email?: unknown; password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  const { email, password } = body;
  
  // Validate input
  if (!email) {
    throw new MissingFieldError('email');
  }
  if (!password) {
    throw new MissingFieldError('password');
  }
  if (typeof email !== 'string') {
    throw new ValidationError('Email must be a string', { field: 'email' });
  }
  if (typeof password !== 'string') {
    throw new ValidationError('Password must be a string', { field: 'password' });
  }
  
  // Sign up user
  const result = await signUp({ email, password });
  
  // Create an API key for the new user
  let apiKeyResult;
  try {
    apiKeyResult = createNewApiKey(result.user.id, 'Default Key', false);
  } catch (e) {
    // If key creation fails, still return success but without key
    console.error('Failed to create API key for new user:', e);
  }
  
  // Set auth cookie
  const cookieOptions = getAuthCookieOptions();
  c.header('Set-Cookie', 
    `auth_token=${result.token}; ` +
    `HttpOnly; ` +
    `Path=${cookieOptions.path}; ` +
    `Max-Age=${cookieOptions.maxAge}; ` +
    `SameSite=${cookieOptions.sameSite}` +
    (cookieOptions.secure ? '; Secure' : '')
  );
  
  // Return user, token, and API key
  return c.json({
    success: true,
    user: result.user,
    token: result.token,
    expiresAt: result.expiresAt,
    apiKey: apiKeyResult ? {
      id: apiKeyResult.id,
      key: apiKeyResult.key, // Full API key - only shown once!
      prefix: apiKeyResult.prefix,
      name: apiKeyResult.name,
      createdAt: apiKeyResult.createdAt,
    } : null,
    warning: apiKeyResult ? 'Save your API key! It will only be shown once.' : null,
  }, 201);
});

/**
 * POST /api/v1/auth/login
 * Authenticate user and get token
 */
authRoutes.post('/login', async (c) => {
  // Parse and validate request body
  let body: { email?: unknown; password?: unknown };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  const { email, password } = body;
  
  // Validate input
  if (!email) {
    throw new MissingFieldError('email');
  }
  if (!password) {
    throw new MissingFieldError('password');
  }
  if (typeof email !== 'string') {
    throw new ValidationError('Email must be a string', { field: 'email' });
  }
  if (typeof password !== 'string') {
    throw new ValidationError('Password must be a string', { field: 'password' });
  }
  
  // Login user
  const result = await login({ email, password });
  
  // Set auth cookie
  const cookieOptions = getAuthCookieOptions();
  c.header('Set-Cookie', 
    `auth_token=${result.token}; ` +
    `HttpOnly; ` +
    `Path=${cookieOptions.path}; ` +
    `Max-Age=${cookieOptions.maxAge}; ` +
    `SameSite=${cookieOptions.sameSite}` +
    (cookieOptions.secure ? '; Secure' : '')
  );
  
  // Return user and token
  return c.json({
    success: true,
    user: result.user,
    token: result.token,
    expiresAt: result.expiresAt
  });
});

/**
 * POST /api/v1/auth/logout
 * Clear authentication session
 */
authRoutes.post('/logout', async (c) => {
  // Clear auth cookie
  const cookieOptions = getClearCookieOptions();
  c.header('Set-Cookie', 
    `auth_token=; ` +
    `HttpOnly; ` +
    `Path=${cookieOptions.path}; ` +
    `Max-Age=0; ` +
    `SameSite=${cookieOptions.sameSite}` +
    (cookieOptions.secure ? '; Secure' : '')
  );
  
  return c.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * GET /api/v1/auth/me
 * Get current authenticated user
 */
authRoutes.get('/me', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  // This should never happen since requireAuth throws if not authenticated
  // But TypeScript needs the check
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const user = await getUser(authUser.userId);
  
  if (!user) {
    throw new NotFoundError('User');
  }
  
  return c.json({
    success: true,
    user
  });
});

/**
 * POST /api/v1/auth/forgot-password
 * Request password reset
 */
authRoutes.post('/forgot-password', async (c) => {
  // Parse and validate request body
  let body: { email?: unknown };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  const { email } = body;
  
  if (!email) {
    throw new MissingFieldError('email');
  }
  if (typeof email !== 'string') {
    throw new ValidationError('Email must be a string', { field: 'email' });
  }
  
  const result = await initiatePasswordReset(email);
  
  // Always return success to avoid revealing if email exists
  // In production, you would send the token via email
  if (result) {
    // Log for dev - in production this would send an email
    console.log(`[DEV] Password reset token for ${email}: ${result.token}`);
  }
  
  return c.json({
    success: true,
    message: 'If an account with that email exists, a reset link has been sent'
  });
});

/**
 * POST /api/v1/auth/reset-password
 * Complete password reset with token
 */
authRoutes.post('/reset-password', async (c) => {
  // Parse and validate request body
  let body: { token?: unknown; newPassword?: unknown };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  const { token, newPassword } = body;
  
  if (!token) {
    throw new MissingFieldError('token');
  }
  if (!newPassword) {
    throw new MissingFieldError('newPassword');
  }
  if (typeof token !== 'string') {
    throw new ValidationError('Token must be a string', { field: 'token' });
  }
  if (typeof newPassword !== 'string') {
    throw new ValidationError('New password must be a string', { field: 'newPassword' });
  }
  
  const success = await completePasswordReset(token, newPassword);
  
  if (!success) {
    throw new ValidationError('Invalid or expired reset token', { field: 'token' });
  }
  
  return c.json({
    success: true,
    message: 'Password reset successfully'
  });
});

/**
 * POST /api/v1/auth/change-password
 * Change password for authenticated user
 */
authRoutes.post('/change-password', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }

  // Parse and validate request body
  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  const { currentPassword, newPassword } = body;
  
  if (!currentPassword) {
    throw new MissingFieldError('currentPassword');
  }
  if (!newPassword) {
    throw new MissingFieldError('newPassword');
  }
  if (typeof currentPassword !== 'string') {
    throw new ValidationError('Current password must be a string', { field: 'currentPassword' });
  }
  if (typeof newPassword !== 'string') {
    throw new ValidationError('New password must be a string', { field: 'newPassword' });
  }
  
  await changePassword(authUser.userId, currentPassword, newPassword);
  
  return c.json({
    success: true,
    message: 'Password changed successfully'
  });
});

/**
 * POST /api/v1/auth/verify-email
 * Verify email address with token
 */
authRoutes.post('/verify-email', async (c) => {
  // Parse and validate request body
  let body: { token?: unknown };
  try {
    body = await c.req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  const { token } = body;
  
  if (!token) {
    throw new MissingFieldError('token');
  }
  if (typeof token !== 'string') {
    throw new ValidationError('Token must be a string', { field: 'token' });
  }
  
  const success = await completeEmailVerification(token);
  
  if (!success) {
    throw new ValidationError('Invalid verification token', { field: 'token' });
  }
  
  return c.json({
    success: true,
    message: 'Email verified successfully'
  });
});

/**
 * POST /api/v1/auth/resend-verification
 * Resend verification email
 */
authRoutes.post('/resend-verification', requireAuth, async (c) => {
  const authUser = getAuthUser(c);
  
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated');
  }
  
  const token = await initiateEmailVerification(authUser.userId);
  
  if (!token) {
    throw new NotFoundError('User');
  }
  
  // In production, send email with verification link
  console.log(`[DEV] Verification token for ${authUser.email}: ${token}`);
  
  return c.json({
    success: true,
    message: 'Verification email sent'
  });
});