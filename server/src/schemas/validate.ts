import type { z } from 'zod'
import { HttpError } from '../errors.js'

// Validates request data with a Zod schema. Invalid data becomes a 400
// with the message of the first problem found.
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data)
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? 'Invalid request')
  return result.data
}

// Route ids: "12" → 12; anything that is not a positive whole number → 404,
// the same answer as an id that does not exist.
export function parseId(value: unknown, notFoundMessage: string): number {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(404, notFoundMessage)
  return id
}
