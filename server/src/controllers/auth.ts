import type { Request, RequestHandler } from 'express'
import { prisma } from '../db.js'
import { HttpError } from '../errors.js'
import { Prisma, type User } from '../generated/prisma/client.js'
import { loginSchema, registerSchema } from '../schemas/auth.js'
import { parse } from '../schemas/validate.js'
import { hashPassword, verifyPassword } from '../services/passwords.js'
import { SESSION_COOKIE } from '../session.js'

// The user as the API returns it (client/src/types: User). Never includes the password hash.
export function toUserJson(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    specialty: user.specialty,
    isActive: user.isActive,
  }
}

// A new session id on every login, so a session id known before login is useless after it.
function startSession(req: Request, userId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err)
      req.session.userId = userId
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()))
    })
  })
}

// POST /api/auth/register — patients only; doctors join by invitation.
export const register: RequestHandler = async (req, res) => {
  const { name, email, password } = parse(registerSchema, req.body)
  let user: User
  try {
    user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password), role: 'patient' },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'An account with this email already exists.')
    }
    throw err
  }
  await startSession(req, user.id)
  res.status(201).json(toUserJson(user))
}

// POST /api/auth/login
export const login: RequestHandler = async (req, res) => {
  const { email, password } = parse(loginSchema, req.body)
  const user = await prisma.user.findUnique({ where: { email } })
  if (!(await verifyPassword(password, user?.passwordHash)) || !user) {
    throw new HttpError(401, 'Invalid email or password.')
  }
  if (!user.isActive) throw new HttpError(403, 'This account has been deactivated.')

  await startSession(req, user.id)
  res.json(toUserJson(user))
}

// POST /api/auth/logout
export const logout: RequestHandler = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err)
    res.clearCookie(SESSION_COOKIE, { path: '/' })
    res.status(204).end()
  })
}

// GET /api/auth/me — 401 when nobody is logged in (requireLogin).
export const me: RequestHandler = (req, res) => {
  res.json(toUserJson(req.user!))
}
