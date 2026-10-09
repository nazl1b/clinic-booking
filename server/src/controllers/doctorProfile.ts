// The logged-in doctor's own details: /api/doctor/profile
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { bioSchema } from '../schemas/common.js'
import { parse } from '../schemas/validate.js'
import { toUserJson } from './auth.js'

const profileSchema = z.object({ bio: bioSchema }, { error: 'Please send the bio (or null to remove it).' })

// PATCH /api/doctor/profile with { bio } — returns the updated user, like /api/auth/me.
// Name and specialty are changed by the admin only.
export const updateMyProfile: RequestHandler = async (req, res) => {
  const { bio } = parse(profileSchema, req.body)
  res.json(toUserJson(await prisma.user.update({ where: { id: req.user!.id }, data: { bio } })))
}
