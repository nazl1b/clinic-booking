import { z } from 'zod'

export const MIN_PASSWORD_LENGTH = 8
// bcrypt ignores everything after the first 72 bytes, so longer passwords are refused.
const MAX_PASSWORD_BYTES = 72

// Emails are compared and stored lowercase (ARCHITECTURE.md section 6).
export const emailSchema = z.string().trim().toLowerCase()

export const newPasswordSchema = z
  .string({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` })
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  .refine((password) => Buffer.byteLength(password) <= MAX_PASSWORD_BYTES, 'Password must be at most 72 characters.')

export const registerSchema = z.object(
  {
    name: z.string().trim().min(1, 'Please enter your name and a valid email.').max(100, 'Name is too long.'),
    email: emailSchema.pipe(z.email('Please enter your name and a valid email.').max(254, 'Email is too long.')),
    password: newPasswordSchema,
  },
  { error: 'Please enter your name and a valid email.' },
)

export const loginSchema = z.object(
  {
    email: emailSchema.min(1, 'Please enter your email and password.'),
    password: z.string().min(1, 'Please enter your email and password.'),
  },
  { error: 'Please enter your email and password.' },
)

export const forgotPasswordSchema = z.object(
  { email: emailSchema.pipe(z.email('Please enter a valid email.')) },
  { error: 'Please enter a valid email.' },
)

export const INVALID_RESET_LINK = 'This link is invalid or has expired. Please request a new one.'

export const resetPasswordSchema = z.object(
  {
    token: z.string({ error: INVALID_RESET_LINK }).min(1, INVALID_RESET_LINK),
    password: newPasswordSchema,
  },
  { error: INVALID_RESET_LINK },
)

export const changePasswordSchema = z.object(
  {
    currentPassword: z.string({ error: 'Please enter your current password.' }).min(1, 'Please enter your current password.'),
    newPassword: newPasswordSchema,
  },
  { error: 'Please enter your current and new password.' },
)
