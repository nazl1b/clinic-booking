// Forgot / reset password and change password (ARCHITECTURE.md section 8).
import type { RequestHandler } from 'express'
import { prisma } from '../db.js'
import { HttpError } from '../errors.js'
import type { User } from '../generated/prisma/client.js'
import { changePasswordSchema, forgotPasswordSchema, INVALID_RESET_LINK, resetPasswordSchema } from '../schemas/auth.js'
import { parse } from '../schemas/validate.js'
import { sendEmail } from '../services/email.js'
import { PASSWORD_RESET_HOURS, passwordResetEmail } from '../services/emailTemplates.js'
import { hashPassword, verifyPassword } from '../services/passwords.js'
import { createToken, hashToken } from '../services/tokens.js'
import { deleteUserSessions } from '../session.js'

const FORGOT_PASSWORD_MESSAGE = 'If this email exists, we sent you a link to reset your password.'

// Creates a new reset link and emails it. Only the newest link works:
// unused older links of the user are deleted.
async function issuePasswordReset(user: User): Promise<void> {
  const { token, tokenHash } = createToken()
  await prisma.$transaction([
    prisma.passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordReset.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + PASSWORD_RESET_HOURS * 3_600_000) },
    }),
  ])
  await sendEmail({ to: user.email, ...passwordResetEmail({ name: user.name, token }) })
}

// POST /api/auth/forgot-password — the same answer whether the email exists or not.
export const forgotPassword: RequestHandler = async (req, res) => {
  const { email } = parse(forgotPasswordSchema, req.body)
  const user = await prisma.user.findUnique({ where: { email } })
  if (user?.isActive) {
    // In the background: waiting for the database writes and the email service would
    // make the answer slower for existing emails and reveal which ones exist.
    issuePasswordReset(user).catch((err: unknown) => console.error('Password reset email failed:', err))
  }
  res.json({ message: FORGOT_PASSWORD_MESSAGE })
}

// POST /api/auth/reset-password — new password with the token from the link.
// Afterwards every session of the user is logged out.
export const resetPassword: RequestHandler = async (req, res) => {
  const { token, password } = parse(resetPasswordSchema, req.body)
  const passwordHash = await hashPassword(password)

  const userId = await prisma.$transaction(async (tx) => {
    const reset = await tx.passwordReset.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } })
    if (!reset?.user.isActive) return null
    // Marks the link as used only while it is still unused and not expired.
    // Of two simultaneous requests with the same link, only one gets count 1.
    const { count } = await tx.passwordReset.updateMany({
      where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    })
    if (count === 0) return null
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } })
    return reset.userId
  })
  if (userId === null) throw new HttpError(400, INVALID_RESET_LINK)

  await deleteUserSessions(userId)
  res.status(204).end()
}

// PATCH /api/auth/password — logged in; needs the current password.
// The user's other sessions are logged out, the current one stays.
export const changePassword: RequestHandler = async (req, res) => {
  const { currentPassword, newPassword } = parse(changePasswordSchema, req.body)
  const user = req.user!
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'Your current password is incorrect.')
  }
  if (newPassword === currentPassword) {
    throw new HttpError(400, 'The new password must be different from the current one.')
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } })
  await deleteUserSessions(user.id, req.sessionID)
  res.status(204).end()
}
