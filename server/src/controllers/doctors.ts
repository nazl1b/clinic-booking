// Doctor directory and free slots: /api/doctors
import type { RequestHandler } from 'express'
import { prisma } from '../db.js'
import { HttpError } from '../errors.js'
import { dateSchema } from '../schemas/common.js'
import { parse } from '../schemas/validate.js'
import { toDoctorJson } from '../serializers.js'
import { freeSlots } from '../services/slots.js'

// "12" → 12; anything that is not a positive whole number → 404
export function parseId(value: unknown, notFoundMessage: string): number {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(404, notFoundMessage)
  return id
}

// GET /api/doctors — patients; active doctors only.
export const listDoctors: RequestHandler = async (_req, res) => {
  const doctors = await prisma.user.findMany({ where: { role: 'doctor', isActive: true }, orderBy: { name: 'asc' } })
  res.json(doctors.map(toDoctorJson))
}

// GET /api/doctors/:id/slots?date=YYYY-MM-DD — any logged-in role.
// Patients: active doctors only (deactivated → 404, like a doctor that does not exist).
// Doctors: their own slots only (another doctor → 403).
// Admins: any doctor (deactivated → empty list).
export const getDoctorSlots: RequestHandler = async (req, res) => {
  const user = req.user!
  const doctorId = parseId(req.params.id, 'Doctor not found.')
  const date = parse(dateSchema, req.query.date)
  if (user.role === 'doctor' && user.id !== doctorId) throw new HttpError(403, 'You can only see your own free times.')

  const doctor = await prisma.user.findFirst({ where: { id: doctorId, role: 'doctor' } })
  if (!doctor || (user.role === 'patient' && !doctor.isActive)) throw new HttpError(404, 'Doctor not found.')
  res.json(await freeSlots(prisma, doctor, date))
}
