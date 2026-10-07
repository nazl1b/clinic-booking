// The logged-in doctor's schedule: /api/doctor/appointments
import type { RequestHandler } from 'express'
import { appointmentListSchema, staffAppointmentSchema } from '../schemas/appointments.js'
import { parse, parseId } from '../schemas/validate.js'
import { toAppointmentJson } from '../serializers.js'
import { listAppointments } from '../services/appointmentList.js'
import { APPOINTMENT_NOT_FOUND, cancelUpcoming, notifyCancellationInBackground } from '../services/appointments.js'
import { createStaffAppointment } from '../services/staffAppointments.js'

// GET /api/doctor/appointments?search=&status=&kind=&from=&to=&page=&pageSize=
// One page of the doctor's own appointments. The Day view asks for one day
// (from = to, pageSize = 100); the Appointments page uses search and filters.
export const listMyScheduleAppointments: RequestHandler = async (req, res) => {
  const query = parse(appointmentListSchema, req.query)
  res.json(await listAppointments(query, { doctorId: req.user!.id }))
}

// POST /api/doctor/appointments — phone appointment or blocked time in the doctor's
// own schedule (a doctorId in the body is ignored).
export const createMyScheduleAppointment: RequestHandler = async (req, res) => {
  const input = parse(staffAppointmentSchema, req.body)
  const appointment = await createStaffAppointment(input, req.user!.id, req.user!.id)
  res.status(201).json(toAppointmentJson(appointment))
}

// PATCH /api/doctor/appointments/:id/cancel — only appointments in the doctor's own
// schedule (another doctor's is a 404). The patient of an online appointment is emailed.
export const cancelMyScheduleAppointment: RequestHandler = async (req, res) => {
  const id = parseId(req.params.id, APPOINTMENT_NOT_FOUND)
  await cancelUpcoming(id, { doctorId: req.user!.id })
  notifyCancellationInBackground(id, 'Please book another time.')
  res.status(204).end()
}
