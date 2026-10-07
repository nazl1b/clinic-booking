import { z } from 'zod'
import { toMinutes } from '../utils/dates.js'
import { timeSchema } from './common.js'

const MAX_WINDOWS = 70 // 10 per day is far more than any real schedule needs

const windowSchema = z
  .object({
    dayOfWeek: z.number('Invalid day.').int('Invalid day.').min(0, 'Invalid day.').max(6, 'Invalid day.'),
    startTime: timeSchema,
    endTime: timeSchema,
    slotMinutes: z
      .number('Slot length must be between 5 and 240 minutes.')
      .int('Slot length must be between 5 and 240 minutes.')
      .min(5, 'Slot length must be between 5 and 240 minutes.')
      .max(240, 'Slot length must be between 5 and 240 minutes.'),
  })
  .refine((w) => toMinutes(w.startTime) < toMinutes(w.endTime), 'Start time must be before end time.')
  .refine((w) => toMinutes(w.endTime) - toMinutes(w.startTime) >= w.slotMinutes, 'Working hours must be at least one appointment long.')

// The whole weekly schedule; an empty list closes every day.
export const availabilitySchema = z
  .array(windowSchema, 'Invalid working hours.')
  .max(MAX_WINDOWS, 'Too many working hours.')
  .superRefine((windows, ctx) => {
    for (const [i, a] of windows.entries()) {
      for (const b of windows.slice(i + 1)) {
        if (a.dayOfWeek !== b.dayOfWeek) continue
        if (a.slotMinutes !== b.slotMinutes) {
          ctx.addIssue({ code: 'custom', message: 'All working hours on the same day must use the same appointment length.' })
          return
        }
        if (toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime)) {
          ctx.addIssue({ code: 'custom', message: 'Working hours on the same day overlap.' })
          return
        }
      }
    }
  })

export type AvailabilityWindow = z.infer<typeof windowSchema>
