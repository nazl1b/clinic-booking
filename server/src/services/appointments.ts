// Appointment actions shared by the patient, doctor and admin endpoints.
import { prisma } from '../db.js'
import { HttpError } from '../errors.js'
import type { Prisma } from '../generated/prisma/client.js'
import { clinicNow, dateFromDb, dateToDb, timeFromDb, timeToDb } from '../utils/dates.js'
import { sendEmail } from './email.js'
import { cancellationEmail } from './emailTemplates.js'

export const APPOINTMENT_NOT_FOUND = 'Appointment not found.'

// Appointments that start after the current minute in clinic time.
// An appointment whose start time has come is past: it can no longer be cancelled.
export function upcomingWhere(): Prisma.AppointmentWhereInput {
  const now = clinicNow()
  return {
    OR: [{ date: { gt: dateToDb(now.date) } }, { date: dateToDb(now.date), time: { gt: timeToDb(now.time) } }],
  }
}

// Cancels appointment `id` if it is inside `scope` (e.g. { patientId } or { doctorId }),
// active and upcoming. Checked and changed in one statement, so nothing can change
// in between (e.g. two simultaneous cancels). Outside the scope is a 404, like an id
// that does not exist.
export async function cancelUpcoming(id: number, scope: Prisma.AppointmentWhereInput = {}): Promise<void> {
  const { count } = await prisma.appointment.updateMany({
    where: { AND: [{ id, status: 'active' }, scope, upcomingWhere()] },
    data: { status: 'cancelled' },
  })
  if (count === 1) return

  // Nothing was cancelled: find out why.
  const appointment = await prisma.appointment.findFirst({ where: { AND: [{ id }, scope] } })
  if (!appointment) throw new HttpError(404, APPOINTMENT_NOT_FOUND)
  if (appointment.status !== 'active') throw new HttpError(400, 'This appointment is already cancelled.')
  throw new HttpError(400, 'Past appointments cannot be cancelled.')
}

// Emails the patient of a cancelled online appointment. Phone appointments and
// blocks have no email. Returns true if an email was sent.
export async function notifyCancellation(id: number, reason: string): Promise<boolean> {
  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id },
    include: { doctor: { select: { name: true } }, patient: { select: { name: true, email: true } } },
  })
  if (appointment.kind !== 'online' || !appointment.patient) return false
  await sendEmail({
    to: appointment.patient.email,
    ...cancellationEmail({
      patientName: appointment.patient.name,
      doctorName: appointment.doctor.name,
      date: dateFromDb(appointment.date),
      time: timeFromDb(appointment.time),
      reason,
    }),
  })
  return true
}

// Sends the cancellation email without making the request wait for the email service.
// A failure is logged; the appointment stays cancelled either way.
export function notifyCancellationInBackground(id: number, reason: string): void {
  notifyCancellation(id, reason).catch((err: unknown) => console.error(`Cancellation email for appointment ${id} failed:`, err))
}
