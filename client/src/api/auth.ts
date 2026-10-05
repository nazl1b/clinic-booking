// Auth endpoints: /api/auth/*

import type { Role, User } from '../types';
import { ApiError, copy, delay } from './client';
import { db, nextId, randomToken, setSessionUserId } from './mock/db';
import { sendMockEmail } from './mock/emails';
import { normalizeEmail, requireLogin, toUser } from './mock/guards';

const MIN_PASSWORD_LENGTH = 8;

function checkPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

// Mock of express-rate-limit: 5 failed logins within 15 minutes -> 429.
const failedLogins: number[] = [];
const RATE_WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;

// POST /api/auth/register
export async function register(input: { name: string; email: string; password: string }): Promise<User> {
  await delay();
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (!name || !email.includes('@')) throw new ApiError(400, 'Please enter your name and a valid email.');
  checkPassword(input.password);
  if (db.users.some((u) => u.email === email)) throw new ApiError(409, 'An account with this email already exists.');

  const user = { id: nextId('users'), name, email, password: input.password, role: 'patient' as const, specialty: null, isActive: true };
  db.users.push(user);
  setSessionUserId(user.id);
  return copy(toUser(user));
}

// POST /api/auth/login
export async function login(input: { email: string; password: string }): Promise<User> {
  await delay();
  const now = Date.now();
  while (failedLogins.length && failedLogins[0] < now - RATE_WINDOW_MS) failedLogins.shift();
  if (failedLogins.length >= MAX_FAILURES) throw new ApiError(429, 'Too many attempts. Please try again in a few minutes.');

  const email = normalizeEmail(input.email);
  const user = db.users.find((u) => u.email === email && u.password === input.password);
  if (!user) {
    failedLogins.push(now);
    throw new ApiError(401, 'Invalid email or password.');
  }
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated.');
  setSessionUserId(user.id);
  return copy(toUser(user));
}

// POST /api/auth/logout
export async function logout(): Promise<void> {
  await delay(100);
  setSessionUserId(null);
}

// GET /api/auth/me — returns null instead of throwing 401, for convenience.
export async function getMe(): Promise<User | null> {
  await delay(100);
  try {
    return copy(toUser(requireLogin()));
  } catch {
    setSessionUserId(null);
    return null;
  }
}

// POST /api/auth/forgot-password — same answer whether the email exists or not.
export async function forgotPassword(emailInput: string): Promise<string> {
  await delay();
  const email = normalizeEmail(emailInput);
  const user = db.users.find((u) => u.email === email && u.isActive);
  if (user) {
    const token = randomToken();
    db.passwordResets.push({
      id: nextId('passwordResets'),
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      usedAt: null,
    });
    const link = `/reset-password?token=${token}`;
    sendMockEmail({ to: user.email, subject: 'Reset your password', body: 'Use this link within 1 hour to set a new password.', link });
  }
  return 'If this email exists, we sent you a link to reset your password.';
}

// POST /api/auth/reset-password
export async function resetPassword(input: { token: string; password: string }): Promise<void> {
  await delay();
  const reset = db.passwordResets.find((r) => r.token === input.token);
  if (!reset || reset.usedAt || new Date(reset.expiresAt) < new Date()) {
    throw new ApiError(400, 'This link is invalid or has expired. Please request a new one.');
  }
  checkPassword(input.password);
  const user = db.users.find((u) => u.id === reset.userId);
  if (!user) throw new ApiError(400, 'This link is invalid or has expired.');

  user.password = input.password;
  reset.usedAt = new Date().toISOString();
  // All sessions of the user are logged out.
  setSessionUserId(null);
}

// PATCH /api/auth/password — change password while logged in.
export async function changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
  await delay();
  const user = requireLogin();
  if (user.password !== input.currentPassword) throw new ApiError(400, 'Your current password is incorrect.');
  checkPassword(input.newPassword);
  user.password = input.newPassword;
  // The backend also logs out the user's other sessions; the current one stays.
}

// Development only: log in as the first active seeded user with the given role.
export async function devLoginAs(role: Role): Promise<User> {
  const user = db.users.find((u) => u.role === role && u.isActive);
  if (!user) throw new ApiError(404, `No active ${role} account in the mock data.`);
  setSessionUserId(user.id);
  return copy(toUser(user));
}
