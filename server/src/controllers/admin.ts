// Admin: doctors and every appointment of the clinic. /api/admin/*
// (Invitations are in controllers/invitations.ts.)
import type { RequestHandler } from 'express'
import { prisma } from '../db.js'
import { HttpError } from '../errors.js'
import type { Prisma } from '../generated/prisma/client.js'
import { doctorActiveSchema, doctorDetailsSchema, doctorListSchema } from '../schemas/admin.js'
import { appointmentListSchema, staffAppointmentSchema } from '../schemas/appointments.js'
import { DEFAULT_PAGE_SIZE } from '../schemas/common.js'
import { parse, parseId } from '../schemas/validate.js'
import { toAppointmentJson, toDoctorJson } from '../serializers.js'
import { listAppointments } from '../services/appointmentList.js'
import { APPOINTMENT_NOT_FOUND, cancelUpcoming, notifyCancellationInBackground, upcomingWhere } from '../services/appointments.js'
import { deactivateDoctor } from '../services/doctors.js'
import { createStaffAppointment } from '../services/staffAppointments.js'
import { escapeLike } from '../utils/search.js'

const DOCTOR_NOT_FOUND = 'Doctor not found.'

async function findDoctor(id: number) {
  const doctor = await prisma.user.findFirst({ where: { id, role: 'doctor' } })
  if (!doctor) throw new HttpError(404, DOCTOR_NOT_FOUND)
  return doctor
}

// ---------- doctors ----------

// GET /api/admin/doctors?search=&status=&page=&pageSize= — one page (20 by default)
// and the total. Deactivated ones included unless filtered out; active first, then by name.
export const listAllDoctors: RequestHandler = async (req, res) => {
  const query = parse(doctorListSchema, req.query)
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE

  const filters: Prisma.UserWhereInput[] = [{ role: 'doctor' }]
  if (query.status) filters.push({ isActive: query.status === 'active' })
  if (query.search) {
    const text = escapeLike(query.search)
    filters.push({
      OR: [
        { name: { contains: text, mode: 'insensitive' } },
        { specialty: { contains: text, mode: 'insensitive' } },
        { email: { contains: text, mode: 'insensitive' } },
      ],
    })
  }
  const where: Prisma.UserWhereInput = { AND: filters }

  const [total, doctors] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: [{ isActive: 'desc' }, { name: 'asc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
  ])
  res.json({ items: doctors.map(toDoctorJson), page, pageSize, total })
}

// GET /api/admin/doctors/:id/upcoming-count — upcoming active appointments
// (blocks not counted), for the warning before deactivation.
export const getUpcomingCount: RequestHandler = async (req, res) => {
  const doctor = await findDoctor(parseId(req.params.id, DOCTOR_NOT_FOUND))
  const count = await prisma.appointment.count({
    where: { AND: [{ doctorId: doctor.id, status: 'active', kind: { not: 'block' } }, upcomingWhere()] },
  })
  res.json({ count })
}

// PATCH /api/admin/doctors/:id
//   { name, specialty } → edits the details, returns the doctor
//   { isActive: false } → deactivates (services/doctors.ts), returns the result
//   { isActive: true }  → reactivates, returns the doctor
export const updateDoctor: RequestHandler = async (req, res) => {
  const doctor = await findDoctor(parseId(req.params.id, DOCTOR_NOT_FOUND))

  if (req.body && typeof req.body === 'object' && 'isActive' in req.body) {
    const { isActive } = parse(doctorActiveSchema, req.body)
    if (!isActive) {
      res.json(await deactivateDoctor(doctor.id))
      return
    }
    res.json(toDoctorJson(await prisma.user.update({ where: { id: doctor.id }, data: { isActive: true } })))
    return
  }

  const { name, specialty, bio } = parse(doctorDetailsSchema, req.body)
  res.json(toDoctorJson(await prisma.user.update({ where: { id: doctor.id }, data: { name, specialty, bio } })))
}

// ---------- appointments ----------

// GET /api/admin/appointments?search=&status=&kind=&from=&to=&doctor=&page=&pageSize=
export const listAllAppointments: RequestHandler = async (req, res) => {
  res.json(await listAppointments(parse(appointmentListSchema, req.query)))
}

// POST /api/admin/appointments — phone appointment or blocked time for any doctor,
// like a receptionist.
export const createAdminAppointment: RequestHandler = async (req, res) => {
  const input = parse(staffAppointmentSchema, req.body)
  if (input.doctorId === undefined) throw new HttpError(400, 'Please choose a doctor.')
  const doctor = await findDoctor(input.doctorId)
  const appointment = await createStaffAppointment(input, doctor.id, req.user!.id)
  res.status(201).json(toAppointmentJson(appointment))
}

// PATCH /api/admin/appointments/:id/cancel — any doctor's upcoming appointment.
// The patient of an online appointment is emailed.
export const cancelAnyAppointment: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id, APPOINTMENT_NOT_FOUND)
  await cancelUpcoming(id)
  notifyCancellationInBackground(id, 'Please book another time.')
  res.status(204).end()
}
