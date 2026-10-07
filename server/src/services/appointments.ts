import type { Prisma } from '../generated/prisma/client.js'
import { clinicNow, dateToDb, timeToDb } from '../utils/dates.js'

// Appointments that start after the current minute in clinic time.
// An appointment whose start time has come is past: it can no longer be cancelled.
export function upcomingWhere(): Prisma.AppointmentWhereInput {
  const now = clinicNow()
  return {
    OR: [{ date: { gt: dateToDb(now.date) } }, { date: dateToDb(now.date), time: { gt: timeToDb(now.time) } }],
  }
}
