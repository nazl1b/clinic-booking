// Choices on the Working hours page: the appointment lengths and the times a
// working window may start or end (24-hour clock, so no am/pm and no odd times
// such as 09:07).

import { fromMinutes, toMinutes } from './dates';

export const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60]; // appointment lengths, in minutes

export const FIRST_TIME = '06:00'; // earliest start
export const LAST_TIME = '23:30'; // latest end

// Minutes between two offered times for an appointment length: the length itself
// when it divides an hour (10, 15, 20, 30, 60), otherwise the largest step that
// does (45 → 15), so every full hour can always be chosen.
export function timeStepFor(slotMinutes: number): number {
  let a = slotMinutes;
  let b = 60;
  while (b) [a, b] = [b, a % b];
  return a;
}

// "06:00", "06:30" … "23:30" for 30-minute appointments.
export function timeOptions(slotMinutes: number): string[] {
  const step = timeStepFor(slotMinutes);
  const options: string[] = [];
  for (let m = toMinutes(FIRST_TIME); m <= toMinutes(LAST_TIME); m += step) options.push(fromMinutes(m));
  return options;
}
