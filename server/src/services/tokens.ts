import { createHash, randomBytes } from 'node:crypto'

// One-time tokens for password reset and invitation links.
// The token itself exists only in the emailed link; the database keeps its SHA-256.
// A slow hash like bcrypt is not needed: 32 random bytes cannot be guessed, and a
// plain hash can be looked up through the unique index on token_hash.
export function createToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
