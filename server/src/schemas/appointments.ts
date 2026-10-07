import { z } from 'zod'
import { dateSchema, timeSchema } from './common.js'

// POST /api/appointments (patient booking). The length comes from the doctor's
// working hours, never from the browser.
export const bookingSchema = z.object(
  {
    doctorId: z.number('Please choose a doctor.').int('Please choose a doctor.').positive('Please choose a doctor.'),
    date: dateSchema,
    time: timeSchema,
  },
  { error: 'Please choose a doctor, a date and a time.' },
)
