// Doctor invitation endpoints used by the invited doctor: /api/invitations/:token
// No login: the doctor has no account yet.

import type { InvitationPreview } from '../types';
import { request } from './client';

// GET /api/invitations/:token — 404 if the link is invalid, expired or used.
export function getInvitation(token: string): Promise<InvitationPreview> {
  return request('GET', `/invitations/${encodeURIComponent(token)}`);
}

// POST /api/invitations/:token/accept — the doctor sets their own password.
export function acceptInvitation(token: string, password: string): Promise<void> {
  return request('POST', `/invitations/${encodeURIComponent(token)}/accept`, { body: { password } });
}
