// "2026-10-08" → "Thu, 8 Oct 2026", the same format the client shows.
// The date is a calendar date (no time zone), so it is formatted as UTC.
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`))
}

// DATE columns: Prisma reads and writes them as Date objects at midnight UTC.
// "2026-10-08" → 2026-10-08T00:00:00Z
export function dateToDb(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

// 2026-10-08T00:00:00Z → "2026-10-08"
export function dateFromDb(value: Date): string {
  return value.toISOString().slice(0, 10)
}

// TIME columns: Prisma reads and writes them as Date objects on 1970-01-01 (UTC).
// "09:30" → 1970-01-01T09:30:00Z
export function timeToDb(time: string): Date {
  return new Date(`1970-01-01T${time}:00Z`)
}

// 1970-01-01T09:30:00Z → "09:30"
export function timeFromDb(value: Date): string {
  return value.toISOString().slice(11, 16)
}

// "09:30" → 570
export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// 570 → "09:30"
export function fromMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// 0 = Sunday … 6 = Saturday, like availability.day_of_week
export function dayOfWeek(date: string): number {
  return dateToDb(date).getUTCDay()
}

// "YYYY-MM-DD" that exists in the calendar ("2026-02-30" does not)
export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(dateToDb(date).getTime()) && dateFromDb(dateToDb(date)) === date
}

// Current date and time in the clinic's time zone (CLINIC_TIMEZONE, Europe/Athens).
// The server itself runs in UTC on Render, so "now" and "today" are never taken
// from the server's own clock settings.
export function clinicNow(): { date: string; time: string } {
  const timeZone = process.env.CLINIC_TIMEZONE
  if (!timeZone) throw new Error('CLINIC_TIMEZONE is not set')
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

// "2026-10-08", 1 → "2026-10-09"
export function addDays(date: string, days: number): string {
  const d = dateToDb(date)
  d.setUTCDate(d.getUTCDate() + days)
  return dateFromDb(d)
}
