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
