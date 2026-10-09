import { z } from 'zod'
import { isValidDate } from '../utils/dates.js'

// "HH:MM", 24-hour clock
export const timeSchema = z.string('Please enter times as HH:MM.').regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Please enter times as HH:MM.')

// "YYYY-MM-DD", a real calendar date
export const dateSchema = z.string('Please choose a valid date.').refine(isValidDate, 'Please choose a valid date.')

// A doctor's bio: optional short text shown to patients on the doctor's page.
// Empty (or only spaces) or null clears it. Same limit in client/src/utils/limits.ts.
export const BIO_MAX_LENGTH = 500
export const bioSchema = z
  .string('The bio must be text.')
  .trim()
  .max(BIO_MAX_LENGTH, `The bio is too long (at most ${BIO_MAX_LENGTH} characters).`)
  .transform((bio) => bio || null)
  .nullable()
