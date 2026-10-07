// Patient appointments: /api/appointments
import type { RequestHandler } from 'express'
import { prisma } from '../db.js'
import { HttpError } from '../errors.js'
import { bookingSchema } from '../schemas/appointments.js'
import { parse, parseId } from '../schemas/validate.js'
import { appointmentInclude, toAppointmentJson } from '../serializers.js'
import { APPOINTMENT_NOT_FOUND, cancelUpcoming } from '../services/appointments.js'
import { findSlot, inDoctorDayTransaction, SLOT_NOT_AVAILABLE, SLOT_TAKEN } from '../services/slots.js'
import { dateToDb, timeToDb } from '../utils/dates.js'

// POST /api/appointments — the server re-checks the slot and never trusts the browser:
// the time must be one of the free slots of an active doctor.
//   409: the time is part of the working hours but an active appointment holds it
//   400: anything else (outside working hours, in the past, inactive doctor…)
export const bookAppointment: RequestHandler = async (req, res) => {
  const { doctorId, date, time } = parse(bookingSchema, req.body)
  const patient = req.user!

  const appointment = await inDoctorDayTransaction(doctorId, date, async (tx) => {
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
  })
  res.status(201).json(toAppointmentJson(appointment))
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

// PATCH /api/appointments/:id/cancel — only the patient's own, active, upcoming appointments.
// Another patient's appointment is a 404, like one that does not exist. No email:
// the patient cancelled it themselves.
export const cancelMyAppointment: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id, APPOINTMENT_NOT_FOUND)
  await cancelUpcoming(id, { patientId: req.user!.id })
  res.status(204).end()
}
