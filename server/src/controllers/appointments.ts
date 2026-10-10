// Patient appointments: /api/appointments
import type { RequestHandler } from 'express'
import { HttpError } from '../errors.js'
import { bookingSchema, myAppointmentsSchema } from '../schemas/appointments.js'
import { parse, parseId } from '../schemas/validate.js'
import { appointmentInclude, toAppointmentJson } from '../serializers.js'
import { listPatientAppointments } from '../services/appointmentList.js'
import { APPOINTMENT_NOT_FOUND, cancelUpcoming } from '../services/appointments.js'
import { findSlot, inDoctorDayTransaction, lockActiveDoctor, SLOT_NOT_AVAILABLE, SLOT_TAKEN } from '../services/slots.js'
import { dateToDb, timeToDb } from '../utils/dates.js'

// POST /api/appointments — the server re-checks the slot and never trusts the browser:
// the time must be one of the free slots of an active doctor.
//   409: the time is part of the working hours but an active appointment holds it
//   400: anything else (outside working hours, in the past, inactive doctor…)
export const bookAppointment: RequestHandler = async (req, res) => {
  const { doctorId, date, time, reason, note } = parse(bookingSchema, req.body)
  const patient = req.user!

  const appointment = await inDoctorDayTransaction(doctorId, date, async (tx) => {
    const slot = (await lockActiveDoctor(tx, doctorId)) ? await findSlot(tx, doctorId, date, time) : undefined
    if (!slot) throw new HttpError(400, SLOT_NOT_AVAILABLE)
    if (!slot.free) throw new HttpError(409, SLOT_TAKEN)

    return tx.appointment.create({
      data: {
        doctorId,
        kind: 'online',
        patientId: patient.id,
        createdBy: patient.id,
        reason,
        note,
        date: dateToDb(date),
        time: timeToDb(time),
        durationMinutes: slot.durationMinutes,
      },
      include: appointmentInclude,
    })
  })
  res.status(201).json(toAppointmentJson(appointment))
}

// GET /api/appointments/mine?view=upcoming|past&page=&pageSize=
// One page of the patient's own appointments (10 by default) and the total.
// upcoming: active and not started yet; past: past or cancelled.
export const getMyAppointments: RequestHandler = async (req, res) => {
  const query = parse(myAppointmentsSchema, req.query)
  res.json(await listPatientAppointments(req.user!.id, query))
}

// PATCH /api/appointments/:id/cancel — only the patient's own, active, upcoming appointments.
// Another patient's appointment is a 404, like one that does not exist. No email:
// the patient cancelled it themselves.
export const cancelMyAppointment: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id, APPOINTMENT_NOT_FOUND)
  await cancelUpcoming(id, { patientId: req.user!.id })
  res.status(204).end()
}
