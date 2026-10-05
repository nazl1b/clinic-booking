// Mock version of server/src/services/slots.ts (ARCHITECTURE.md section 9).
// Free slots are never stored: they are computed from the weekly schedule
// minus active appointments (online, manual and blocks) minus past times.

import { clinicNow, dayOfWeek, fromMinutes, toMinutes } from '../../utils/dates';
import { db } from './db';

function activeDoctor(doctorId: number) {
  return db.users.find((u) => u.id === doctorId && u.role === 'doctor' && u.isActive);
}

// Busy intervals [start, end) in minutes for a doctor's day.
function busyIntervals(doctorId: number, date: string, ignoreAppointmentId?: number): [number, number][] {
  return db.appointments
    .filter((a) => a.doctorId === doctorId && a.date === date && a.status === 'active' && a.id !== ignoreAppointmentId)
    .map((a) => [toMinutes(a.time), toMinutes(a.time) + a.durationMinutes]);
}

function overlaps(start: number, end: number, busy: [number, number][]): boolean {
  return busy.some(([bStart, bEnd]) => start < bEnd && bStart < end);
}

function rulesFor(doctorId: number, date: string) {
  const day = dayOfWeek(date);
  return db.availability.filter((r) => r.doctorId === doctorId && r.dayOfWeek === day);
}

// Minutes after midnight before which nothing can be booked on `date`.
function earliestStart(date: string): number | null {
  const now = clinicNow();
  if (date < now.date) return null; // whole day is in the past
  return date === now.date ? toMinutes(now.time) + 1 : 0;
}

export interface FreeSlot {
  time: string;
  durationMinutes: number;
}

export function computeFreeSlots(doctorId: number, date: string): FreeSlot[] {
  if (!activeDoctor(doctorId)) return [];
  const earliest = earliestStart(date);
  if (earliest === null) return [];

  const busy = busyIntervals(doctorId, date);
  const slots: FreeSlot[] = [];
  for (const rule of rulesFor(doctorId, date)) {
    const end = toMinutes(rule.endTime);
    for (let t = toMinutes(rule.startTime); t + rule.slotMinutes <= end; t += rule.slotMinutes) {
      if (t < earliest) continue;
      if (overlaps(t, t + rule.slotMinutes, busy)) continue;
      slots.push({ time: fromMinutes(t), durationMinutes: rule.slotMinutes });
    }
  }
  return slots.sort((a, b) => a.time.localeCompare(b.time));
}

// A block may be longer than one slot, as long as it stays inside a working
// window, is not in the past and does not overlap an active appointment.
export function canBlock(doctorId: number, date: string, time: string, durationMinutes: number): boolean {
  if (!activeDoctor(doctorId) || durationMinutes <= 0) return false;
  const earliest = earliestStart(date);
  if (earliest === null) return false;

  const start = toMinutes(time);
  const end = start + durationMinutes;
  if (start < earliest) return false;
  const insideWindow = rulesFor(doctorId, date).some((r) => start >= toMinutes(r.startTime) && end <= toMinutes(r.endTime));
  return insideWindow && !overlaps(start, end, busyIntervals(doctorId, date));
}
