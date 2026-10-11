// Doctor directory and free slots: /api/doctors
import type { RequestHandler } from 'express'
import { prisma } from '../db.js'
import { HttpError } from '../errors.js'
import { dateSchema } from '../schemas/common.js'
import { parse, parseId } from '../schemas/validate.js'
import { toDoctorJson } from '../serializers.js'
import { freeSlots } from '../services/slots.js'

// GET /api/doctors — patients; active doctors only.
export const listDoctors: RequestHandler = async (_req, res) => {
  const doctors = await prisma.user.findMany({ where: { role: 'doctor', isActive: true }, orderBy: { name: 'asc' } })
  res.json(doctors.map(toDoctorJson))
}

// GET /api/doctors/:id — one doctor for their profile page.
// Patients: active doctors only; a deactivated one is a 404, like one that does not exist.
// Admins: any doctor, deactivated ones too (isActive says which).
export const getDoctor: RequestHandler = async (req, res) => {
  const doctorId = parseId(req.params.id, 'Doctor not found.')
  const onlyActive = req.user!.role !== 'admin'
  const doctor = await prisma.user.findFirst({ where: { id: doctorId, role: 'doctor', ...(onlyActive && { isActive: true }) } })
  if (!doctor) throw new HttpError(404, 'Doctor not found.')
  res.json(toDoctorJson(doctor))
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
