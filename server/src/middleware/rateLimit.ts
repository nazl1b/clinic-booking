import { rateLimit } from 'express-rate-limit'

// Limits are per client IP (correct behind Render thanks to 'trust proxy').
// The counters live in memory, which is enough for a single server instance.
const TOO_MANY = { error: 'Too many attempts. Please try again in a few minutes.' }

// 5 failed logins within 15 minutes; successful logins do not count.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: TOO_MANY,
})

// 5 new accounts per hour.
export const registerLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: TOO_MANY,
})

// 5 forgot-password requests within 15 minutes, whether the email exists or not.
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
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
