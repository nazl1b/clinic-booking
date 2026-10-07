import { z } from 'zod'
import { isValidDate } from '../utils/dates.js'

// "HH:MM", 24-hour clock
export const timeSchema = z.string('Please enter times as HH:MM.').regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Please enter times as HH:MM.')

// "YYYY-MM-DD", a real calendar date
export const dateSchema = z.string('Please choose a valid date.').refine(isValidDate, 'Please choose a valid date.')
