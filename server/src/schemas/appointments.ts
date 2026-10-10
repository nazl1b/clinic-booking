import { z } from 'zod'
import { VisitReason } from '../generated/prisma/enums.js'
import { isValidDate } from '../utils/dates.js'
import { dateSchema, optionalParam, pageParam, pageSizeParam, searchParam, timeSchema } from './common.js'

// Reason for the visit: required for online and phone appointments, not for blocks.
// The values are the VisitReason enum of schema.prisma; labels in client/src/utils/reasons.ts.
const reasonSchema = z.enum(VisitReason, 'Please choose a reason for the visit.')

const noteSchema = z
  .string('Invalid note.')
  .trim()
  .max(200, 'Note is too long (at most 200 characters).')
  .nullish()
  .transform((note) => note || null)

// POST /api/appointments (patient booking). The length comes from the doctor's
// working hours, never from the browser.
export const bookingSchema = z.object(
  {
    doctorId: z.number('Please choose a doctor.').int('Please choose a doctor.').positive('Please choose a doctor.'),
    date: dateSchema,
    time: timeSchema,
    reason: reasonSchema,
    note: noteSchema,
  },
  { error: 'Please choose a doctor, a date and a time.' },
)

const NAME_AND_PHONE = 'Patient name and phone are required.'

// doctorId: ignored for doctors (always their own schedule), required for admins.
const staffDoctorId = z.number('Please choose a doctor.').int('Please choose a doctor.').positive('Please choose a doctor.').optional()

// POST /api/doctor/appointments and /api/admin/appointments:
// a phone appointment (manual) or a blocked period (block).
export const staffAppointmentSchema = z.discriminatedUnion(
  'kind',
  [
    z.object({
      kind: z.literal('manual'),
      doctorId: staffDoctorId,
      date: dateSchema,
      time: timeSchema,
      guestName: z.string(NAME_AND_PHONE).trim().min(1, NAME_AND_PHONE).max(100, 'Name is too long.'),
      guestPhone: z
        .string(NAME_AND_PHONE)
        .trim()
        .min(1, NAME_AND_PHONE)
        .max(30, 'Please enter a valid phone number.')
        .regex(/^[0-9+()\-.\s]+$/, 'Please enter a valid phone number.')
        .refine((phone) => phone.replace(/\D/g, '').length >= 5, 'Please enter a valid phone number.'),
      reason: reasonSchema,
      note: noteSchema,
    }),
    z.object({
      kind: z.literal('block'),
      doctorId: staffDoctorId,
      date: dateSchema,
      time: timeSchema,
      durationMinutes: z
        .number('Invalid length for the blocked time.')
        .int('Invalid length for the blocked time.')
        .min(5, 'Invalid length for the blocked time.')
        .max(720, 'Invalid length for the blocked time.'),
      note: noteSchema,
    }),
  ],
  { error: 'Please choose a phone appointment or a blocked time.' },
)

export type StaffAppointmentInput = z.infer<typeof staffAppointmentSchema>

export const MY_PAGE_SIZE = 10 // the patient's own lists

// Query of the doctor's and the admin's appointment lists (client/src/types: AppointmentQuery).
export const appointmentListSchema = z
  .object({
    search: searchParam,
    status: optionalParam(z.enum(['active', 'cancelled'], 'Invalid status.')),
    kind: optionalParam(z.enum(['online', 'manual', 'block'], 'Invalid type.')),
    from: optionalParam(z.string('Invalid from date.').refine(isValidDate, 'Invalid from date.')),
    to: optionalParam(z.string('Invalid to date.').refine(isValidDate, 'Invalid to date.')),
    doctor: optionalParam(z.coerce.number('Invalid doctor.').int('Invalid doctor.').positive('Invalid doctor.')), // admin only
    page: pageParam,
    pageSize: pageSizeParam,
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, 'The "from" date must be before the "to" date.')

export type AppointmentListQuery = z.infer<typeof appointmentListSchema>

// Query of the patient's own list, GET /api/appointments/mine?view=upcoming&page=2
//   upcoming: active appointments that have not started yet
//   past:     everything else (past or cancelled)
export const myAppointmentsSchema = z.object({
  view: z.enum(['upcoming', 'past'], 'Invalid view.'),
  page: pageParam,
  pageSize: pageSizeParam,
})

export type MyAppointmentsQuery = z.infer<typeof myAppointmentsSchema>
