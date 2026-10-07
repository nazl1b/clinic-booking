// Patient appointments: /api/appointments
import type { RequestHandler } from 'express'
import { prisma } from '../db.js'
import { HttpError } from '../errors.js'
import { Prisma } from '../generated/prisma/client.js'
import { bookingSchema } from '../schemas/appointments.js'
import { parse } from '../schemas/validate.js'
import { appointmentInclude, toAppointmentJson } from '../serializers.js'
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
