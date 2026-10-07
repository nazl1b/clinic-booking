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
