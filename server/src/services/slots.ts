// Free slots (ARCHITECTURE.md section 9). They are never stored; every call
// computes them from the doctor's weekly hours, minus times that overlap an
// active appointment (online, manual or block alike), minus times already past
// in clinic time.
import { prisma } from '../db.js'
import { HttpError } from '../errors.js'
import { Prisma } from '../generated/prisma/client.js'
import { clinicNow, dateToDb, dayOfWeek, fromMinutes, timeFromDb, toMinutes } from '../utils/dates.js'

export const SLOT_TAKEN = 'This time slot was just booked. Please choose another one.'
export const SLOT_NOT_AVAILABLE = 'This time is not available.'

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

// Minutes after midnight from which `date` can still be booked, or null if the
// whole day is past. Today, only times after the current minute.
function earliestStart(date: string): number | null {
  const now = clinicNow()
  if (date < now.date) return null
  return date === now.date ? toMinutes(now.time) + 1 : 0
}

// Working windows of the doctor on the weekday of `date`, in minutes.
async function windowsOn(db: Db, doctorId: number, date: string) {
  const rows = await db.availability.findMany({ where: { doctorId, dayOfWeek: dayOfWeek(date) } })
  return rows.map((w) => ({ start: toMinutes(timeFromDb(w.startTime)), end: toMinutes(timeFromDb(w.endTime)), slotMinutes: w.slotMinutes }))
}

// Each active appointment holds [time, time + duration), e.g. 10:00 for 30 minutes holds 10:00–10:30.
async function busyIntervals(db: Db, doctorId: number, date: string): Promise<(readonly [number, number])[]> {
  const appointments = await db.appointment.findMany({
    where: { doctorId, date: dateToDb(date), status: 'active' },
    select: { time: true, durationMinutes: true },
  })
  return appointments.map((a) => {
    const start = toMinutes(timeFromDb(a.time))
    return [start, start + a.durationMinutes] as const
  })
}

const overlapsAny = (start: number, end: number, busy: (readonly [number, number])[]) =>
  busy.some(([busyStart, busyEnd]) => start < busyEnd && busyStart < end)

async function daySlots(db: Db, doctorId: number, date: string): Promise<DaySlot[]> {
  const earliest = earliestStart(date)
  if (earliest === null) return []
  const windows = await windowsOn(db, doctorId, date)
  const busy = await busyIntervals(db, doctorId, date)

  const slots: DaySlot[] = []
  for (const window of windows) {
    for (let start = window.start; start + window.slotMinutes <= window.end; start += window.slotMinutes) {
      if (start < earliest) continue
      const free = !overlapsAny(start, start + window.slotMinutes, busy)
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

// A blocked period may be longer than one slot, as long as it lies inside one
// working window and is not in the past. "taken" if it overlaps an active appointment.
export async function checkBlock(db: Db, doctorId: number, date: string, time: string, durationMinutes: number): Promise<'ok' | 'unavailable' | 'taken'> {
  const earliest = earliestStart(date)
  const start = toMinutes(time)
  const end = start + durationMinutes
  if (earliest === null || start < earliest) return 'unavailable'
  const windows = await windowsOn(db, doctorId, date)
  if (!windows.some((w) => start >= w.start && end <= w.end)) return 'unavailable'
  return overlapsAny(start, end, await busyIntervals(db, doctorId, date)) ? 'taken' : 'ok'
}

// Runs `fn` in a transaction that first locks the doctor's day: bookings, phone
// appointments and blocks for one doctor and one day wait for each other. Checking
// the free time and inserting the appointment then happen as one step, so two
// simultaneous requests can never both pass the check, even with different start
// times that overlap (which the unique index alone would not catch).
// The partial unique index one_active_per_slot stays as the last line of defence.
export async function inDoctorDayTransaction<T>(doctorId: number, date: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        await lockDoctorDay(tx, doctorId, date)
        return fn(tx)
      },
      // Waiting for the lock counts against the timeout, so allow more than the default 5 s.
      { maxWait: 5_000, timeout: 10_000 },
    )
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw new HttpError(409, SLOT_TAKEN)
    throw err
  }
}

// Holds the lock for one doctor and one day until the transaction ends.
export async function lockDoctorDay(tx: Prisma.TransactionClient, doctorId: number, date: string): Promise<void> {
  const dayNumber = Math.round(dateToDb(date).getTime() / 86_400_000) // days since 1970-01-01
  // $executeRaw: the function returns `void`, which $queryRaw cannot read.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${doctorId}::int, ${dayNumber}::int)`
}

// Inside a booking transaction: true if `doctorId` is an active doctor, and keeps
// the doctor's row locked (FOR SHARE) until the transaction ends. Deactivation
// updates that row, so it waits for bookings in progress and then cancels them,
// and a booking that comes after it sees the doctor as inactive. Either way no
// active appointment is left for a deactivated doctor.
export async function lockActiveDoctor(tx: Prisma.TransactionClient, doctorId: number): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM users WHERE id = ${doctorId}::int AND role = 'doctor' AND is_active FOR SHARE`
  return rows.length === 1
}
