// Weekly working hours of the logged-in doctor.
import type { RequestHandler } from 'express'
import { prisma } from '../db.js'
import { availabilitySchema } from '../schemas/availability.js'
import { parse } from '../schemas/validate.js'
import { timeFromDb, timeToDb } from '../utils/dates.js'

// GET /api/doctor/availability — by day, then start time.
export const getMyAvailability: RequestHandler = async (req, res) => {
  const rows = await prisma.availability.findMany({
    where: { doctorId: req.user!.id },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  })
  res.json(
    rows.map((row) => ({
      dayOfWeek: row.dayOfWeek,
      startTime: timeFromDb(row.startTime),
      endTime: timeFromDb(row.endTime),
      slotMinutes: row.slotMinutes,
    })),
  )
}

// PUT /api/doctor/availability — replaces the whole weekly schedule.
// Appointments that are already booked are kept as they are.
export const saveMyAvailability: RequestHandler = async (req, res) => {
  const windows = parse(availabilitySchema, req.body)
  const doctorId = req.user!.id
  await prisma.$transaction([
    prisma.availability.deleteMany({ where: { doctorId } }),
    prisma.availability.createMany({
      data: windows.map((w) => ({
        doctorId,
        dayOfWeek: w.dayOfWeek,
        startTime: timeToDb(w.startTime),
        endTime: timeToDb(w.endTime),
        slotMinutes: w.slotMinutes,
      })),
    }),
  ])
  res.status(204).end()
}
