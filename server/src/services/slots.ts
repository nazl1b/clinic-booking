// Free slots (ARCHITECTURE.md section 9). They are never stored; every call
// computes them from the doctor's weekly hours, minus times that overlap an
// active appointment (online, manual or block alike), minus times already past
// in clinic time.
import type { prisma } from '../db.js'
import type { Prisma } from '../generated/prisma/client.js'
import { clinicNow, dateToDb, dayOfWeek, fromMinutes, timeFromDb, toMinutes } from '../utils/dates.js'

// Works with the client itself or inside a transaction.
type Db = typeof prisma | Prisma.TransactionClient

export interface FreeSlot {
  time: string // "HH:MM", clinic time
  durationMinutes: number
}

// A slot of the doctor's working hours that is not in the past, free or taken.
interface DaySlot extends FreeSlot {
  free: boolean
}

async function daySlots(db: Db, doctorId: number, date: string): Promise<DaySlot[]> {
  const now = clinicNow()
  if (date < now.date) return []
  // Today, only slots that start after the current minute.
  const earliest = date === now.date ? toMinutes(now.time) + 1 : 0

  const windows = await db.availability.findMany({ where: { doctorId, dayOfWeek: dayOfWeek(date) } })
  const appointments = await db.appointment.findMany({
    where: { doctorId, date: dateToDb(date), status: 'active' },
    select: { time: true, durationMinutes: true },
  })
  // Each appointment holds [time, time + duration), e.g. 10:00 for 30 minutes holds 10:00–10:30.
  const busy = appointments.map((a) => {
    const start = toMinutes(timeFromDb(a.time))
    return [start, start + a.durationMinutes] as const
  })

  const slots: DaySlot[] = []
  for (const window of windows) {
    const end = toMinutes(timeFromDb(window.endTime))
    for (let start = toMinutes(timeFromDb(window.startTime)); start + window.slotMinutes <= end; start += window.slotMinutes) {
      if (start < earliest) continue
      const slotEnd = start + window.slotMinutes
      const free = !busy.some(([busyStart, busyEnd]) => start < busyEnd && busyStart < slotEnd)
      slots.push({ time: fromMinutes(start), durationMinutes: window.slotMinutes, free })
    }
  }
  return slots.sort((a, b) => a.time.localeCompare(b.time))
}

// Free slots of a doctor on a date. A deactivated doctor has none.
export async function freeSlots(db: Db, doctor: { id: number; isActive: boolean }, date: string): Promise<FreeSlot[]> {
  if (!doctor.isActive) return []
  return (await daySlots(db, doctor.id, date)).filter((s) => s.free).map(({ time, durationMinutes }) => ({ time, durationMinutes }))
}

// The slot that starts at `time`, if it is part of the doctor's working hours
// and not in the past: free, or taken by an active appointment.
export async function findSlot(db: Db, doctorId: number, date: string, time: string): Promise<DaySlot | undefined> {
  return (await daySlots(db, doctorId, date)).find((s) => s.time === time)
}

// Serializes bookings for one doctor and one day until the transaction ends.
// Checking the free slots and inserting the appointment then happen as one step,
// so two simultaneous requests can never both pass the check, even with different
// start times that overlap (which the unique index alone would not catch).
export async function lockDoctorDay(tx: Prisma.TransactionClient, doctorId: number, date: string): Promise<void> {
  const dayNumber = Math.round(dateToDb(date).getTime() / 86_400_000) // days since 1970-01-01
  // $executeRaw: the function returns `void`, which $queryRaw cannot read.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${doctorId}::int, ${dayNumber}::int)`
}
