// Date/time helpers. The clinic works in Greek time, whatever the browser's
// time zone is, so "today" and "now" are always computed in Europe/Athens.
// Dates are plain "YYYY-MM-DD" strings and times are "HH:MM" strings.

export const CLINIC_TIMEZONE = 'Europe/Athens';
const LOCALE = 'en-GB'; // day before month: "Mon, 6 Oct 2026"

// A "YYYY-MM-DD" string, e.g. from the URL.
export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Current date and time in the clinic's time zone.
export function clinicNow(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

export function clinicToday(): string {
  return clinicNow().date;
}

// Calendar maths is done on UTC midnight so no local time zone can shift the day.
function toUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const d = toUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Whole days from `from` to `to` (negative when `to` is earlier).
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000);
}

// 0 = Sunday … 6 = Saturday
export function dayOfWeek(date: string): number {
  return toUtcDate(date).getUTCDay();
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// True if the appointment start is already in the past (clinic time).
export function isPast(date: string, time: string): boolean {
  const now = clinicNow();
  return date < now.date || (date === now.date && time <= now.time);
}

// "Mon, 6 Oct 2026"
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(toUtcDate(date));
}

// "Mon"
export function formatWeekday(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short' }).format(toUtcDate(date));
}

// "6 Oct 2026, 14:05" in clinic time, for ISO timestamps.
export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: CLINIC_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Parts of the day for grouping free times, by start time: a time belongs to the
// first part it is before. Morning < 12:00 ≤ Afternoon < 17:00 ≤ Evening.
export const DAY_PARTS = [
  { label: 'Morning', before: '12:00' },
  { label: 'Afternoon', before: '17:00' },
  { label: 'Evening', before: '24:00' },
] as const;

// Items with a "HH:MM" time, grouped by DAY_PARTS; parts without items are left out.
export function groupByDayPart<T extends { time: string }>(items: T[]): { label: string; items: T[] }[] {
  return DAY_PARTS.map((part, i) => ({
    label: part.label,
    items: items.filter((item) => item.time < part.before && (i === 0 || item.time >= DAY_PARTS[i - 1].before)),
  })).filter((group) => group.items.length > 0);
}
