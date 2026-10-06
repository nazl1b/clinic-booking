import type { RequestHandler } from 'express'
import { prisma } from '../db.js'
import { HttpError } from '../errors.js'
import type { Role, User } from '../generated/prisma/client.js'

declare global {
  namespace Express {
    interface Request {
      // Set by loadUser when the request has a valid session.
      user?: User
    }
  }
}

// Loads the logged-in user from the database. A session whose user no longer
// exists or was deactivated is replaced by an empty one (the old one is deleted
// from the database), so the user is logged out at once.
export const loadUser: RequestHandler = async (req, _res, next) => {
  const userId = req.session.userId
  if (userId === undefined) return next()

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user?.isActive) {
    req.user = user
    return next()
  }
  req.session.regenerate((err) => next(err))
}

export const requireLogin: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new HttpError(401, 'Please log in to continue.')
  next()
}

// Use after requireLogin, e.g. router.use(requireLogin, requireRole('admin')).
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw new HttpError(401, 'Please log in to continue.')
    if (!roles.includes(req.user.role)) throw new HttpError(403, 'You do not have permission to do this.')
    next()
  }
}
