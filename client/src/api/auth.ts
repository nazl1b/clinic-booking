// Auth endpoints: /api/auth/*

import type { User } from '../types';
import { ApiError, request } from './client';

// POST /api/auth/register — patients only; logs the new patient in.
export function register(input: { name: string; email: string; password: string }): Promise<User> {
  return request('POST', '/auth/register', { body: input });
}

// POST /api/auth/login
export function login(input: { email: string; password: string }): Promise<User> {
  return request('POST', '/auth/login', { body: input, ignoreUnauthorized: true });
}

// POST /api/auth/logout
export function logout(): Promise<void> {
  return request('POST', '/auth/logout');
}

// GET /api/auth/me — returns null instead of throwing 401, for convenience.
export async function getMe(): Promise<User | null> {
  try {
    return await request<User>('GET', '/auth/me', { ignoreUnauthorized: true });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

// POST /api/auth/forgot-password — same answer whether the email exists or not.
export async function forgotPassword(email: string): Promise<string> {
  const { message } = await request<{ message: string }>('POST', '/auth/forgot-password', { body: { email } });
  return message;
}

// POST /api/auth/reset-password — all sessions of the user are logged out.
export function resetPassword(input: { token: string; password: string }): Promise<void> {
  return request('POST', '/auth/reset-password', { body: input });
}

// PATCH /api/auth/password — change password while logged in.
// The user's other sessions are logged out; the current one stays.
export function changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
  return request('PATCH', '/auth/password', { body: input });
}
