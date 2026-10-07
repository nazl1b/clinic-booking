import type { Request } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'

// Limits are per visitor IP. The counters live in memory, which is enough for a
// single server instance.
//
// On Render, Cloudflare and Render's own proxies sit in front of the app, so req.ip
// (with 'trust proxy' 1) is the address of one of those proxies, and it changes from
// request to request. Cloudflare puts the visitor's address in CF-Connecting-IP and
// overwrites any value a visitor sends, so CLIENT_IP_HEADER=cf-connecting-ip (set in
// render.yaml) makes the limits count per visitor. Locally the header is not set.
const clientIpHeader = process.env.CLIENT_IP_HEADER?.toLowerCase()

export function clientIp(req: Request): string {
  return (clientIpHeader && req.get(clientIpHeader)?.trim()) || req.ip || ''
}

// ipKeyGenerator: an IPv6 visitor counts as their whole /56 block, since one
// person can easily switch between addresses inside it.
const byClientIp = (req: Request) => ipKeyGenerator(clientIp(req))

const TOO_MANY = { error: 'Too many attempts. Please try again in a few minutes.' }

// 5 failed logins within 15 minutes; successful logins do not count.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  keyGenerator: byClientIp,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: TOO_MANY,
})

// 5 new accounts per hour.
export const registerLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: byClientIp,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: TOO_MANY,
})

// 5 forgot-password requests within 15 minutes, whether the email exists or not.
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  keyGenerator: byClientIp,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: TOO_MANY,
})

// 5 wrong current passwords within 15 minutes, counted per logged-in user
// (use after requireLogin). Successful changes do not count.
export const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `user:${req.user!.id}`,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: TOO_MANY,
})
