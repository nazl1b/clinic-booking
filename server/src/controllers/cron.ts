// Jobs called by the external cron service: /api/cron/*
import { timingSafeEqual } from 'node:crypto'
import type { RequestHandler } from 'express'
import { HttpError } from '../errors.js'
import { sendReminders } from '../services/reminders.js'

// The caller sends "Authorization: Bearer <CRON_SECRET>". Without CRON_SECRET the
// endpoint is closed (503), so it can never be left open by mistake.
export const requireCronSecret: RequestHandler = (req, _res, next) => {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new HttpError(503, 'Reminders are not configured.')

  const expected = Buffer.from(`Bearer ${secret}`)
  const given = Buffer.from(req.get('authorization') ?? '')
  // Constant-time comparison: the answer time does not reveal how much of the key matched.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(401, 'Invalid cron secret.')
  }
  next()
}

// POST /api/cron/reminders — emails for tomorrow's online appointments.
export const runReminders: RequestHandler = async (_req, res) => {
  res.json(await sendReminders())
}
