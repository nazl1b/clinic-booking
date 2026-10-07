// Patient appointments: /api/appointments
import type { RequestHandler } from 'express'
import { prisma } from '../db.js'
import { HttpError } from '../errors.js'
import { Prisma } from '../generated/prisma/client.js'
import { bookingSchema } from '../schemas/appointments.js'
import { parse, parseId } from '../schemas/validate.js'
import { appointmentInclude, toAppointmentJson } from '../serializers.js'
import { upcomingWhere } from '../services/appointments.js'
import { findSlot, lockDoctorDay } from '../services/slots.js'
import { dateToDb, timeToDb } from '../utils/dates.js'

export const SLOT_TAKEN = 'This time slot was just booked. Please choose another one.'
export const SLOT_NOT_AVAILABLE = 'This time is not available.'

// Bookings for the same doctor and day wait for each other (lockDoctorDay),
// so give the transaction more time than Prisma's default 5 seconds.
export const BOOKING_TRANSACTION = { maxWait: 5_000, timeout: 10_000 }

// POST /api/appointments — the server re-checks the slot and never trusts the browser:
// the time must be one of the free slots of an active doctor.
//   409: the time is part of the working hours but an active appointment holds it
//   400: anything else (outside working hours, in the past, inactive doctor…)
export const bookAppointment: RequestHandler = async (req, res) => {
  const { doctorId, date, time } = parse(bookingSchema, req.body)
  const patient = req.user!

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      await lockDoctorDay(tx, doctorId, date)
      const doctor = await tx.user.findFirst({ where: { id: doctorId, role: 'doctor', isActive: true } })
      const slot = doctor ? await findSlot(tx, doctorId, date, time) : undefined
      if (!slot) throw new HttpError(400, SLOT_NOT_AVAILABLE)
      if (!slot.free) throw new HttpError(409, SLOT_TAKEN)

      return tx.appointment.create({
        data: {
          doctorId,
          kind: 'online',
          patientId: patient.id,
          createdBy: patient.id,
          date: dateToDb(date),
          time: timeToDb(time),
          durationMinutes: slot.durationMinutes,
        },
        include: appointmentInclude,
      })
    }, BOOKING_TRANSACTION)
    res.status(201).json(toAppointmentJson(appointment))
  } catch (err) {
    // Last line of defence: the partial unique index one_active_per_slot.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new HttpError(409, SLOT_TAKEN)
    throw err
  }
}

// GET /api/appointments/mine — every appointment of the patient (upcoming, past and
// cancelled) by date and time; the page splits them into upcoming and history.
export const getMyAppointments: RequestHandler = async (req, res) => {
  const appointments = await prisma.appointment.findMany({
    where: { patientId: req.user!.id },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    include: appointmentInclude,
  })
  res.json(appointments.map(toAppointmentJson))
}

const APPOINTMENT_NOT_FOUND = 'Appointment not found.'

// PATCH /api/appointments/:id/cancel — only the patient's own, active, upcoming appointments.
// Checked and cancelled in one statement, so nothing can change in between.
// Another patient's appointment is a 404, like one that does not exist.
export const cancelMyAppointment: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id, APPOINTMENT_NOT_FOUND)
  const patientId = req.user!.id

  const { count } = await prisma.appointment.updateMany({
    where: { id, patientId, status: 'active', ...upcomingWhere() },
    data: { status: 'cancelled' },
  })
  if (count === 1) {
    res.status(204).end()
    return
  }

  // Nothing was cancelled: find out why.
  const appointment = await prisma.appointment.findFirst({ where: { id, patientId } })
  if (!appointment) throw new HttpError(404, APPOINTMENT_NOT_FOUND)
  if (appointment.status !== 'active') throw new HttpError(400, 'This appointment is already cancelled.')
  throw new HttpError(400, 'Past appointments cannot be cancelled.')
}
