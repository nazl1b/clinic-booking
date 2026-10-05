// Doctor invitation endpoints used by the invited doctor: /api/invitations/:token

import type { InvitationPreview } from '../types';
import { ApiError, delay } from './client';
import { db, nextId, type InvitationRow } from './mock/db';

function findValidInvitation(token: string): InvitationRow {
  const invitation = db.invitations.find((i) => i.token === token);
  if (!invitation || invitation.usedAt || new Date(invitation.expiresAt) < new Date()) {
    throw new ApiError(404, 'This invitation is invalid, has expired or has already been used.');
  }
  return invitation;
}

// GET /api/invitations/:token
export async function getInvitation(token: string): Promise<InvitationPreview> {
  await delay();
  const { name, email, specialty } = findValidInvitation(token);
  return { name, email, specialty };
}

// POST /api/invitations/:token/accept — the doctor sets their own password.
export async function acceptInvitation(token: string, password: string): Promise<void> {
  await delay();
  const invitation = findValidInvitation(token);
  if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters.');
  if (db.users.some((u) => u.email === invitation.email)) throw new ApiError(409, 'An account with this email already exists.');

  db.users.push({
    id: nextId('users'),
    name: invitation.name,
    email: invitation.email,
    password,
    role: 'doctor',
    specialty: invitation.specialty,
    isActive: true,
  });
  invitation.usedAt = new Date().toISOString();
}
