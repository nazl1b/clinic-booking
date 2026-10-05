// Endpoints for the logged-in doctor: /api/doctor/*

import type { Appointment, AvailabilityRule, StaffAppointmentInput } from '../types';
import { isPast, toMinutes } from '../utils/dates';
import { ApiError, copy, delay } from './client';
import { cancelAndNotify, createStaffAppointment } from './mock/actions';
import { db, nextId } from './mock/db';
import { byDateTime, requireRole, toAppointment } from './mock/guards';

// GET /api/doctor/appointments?from=&to=
export async function getDoctorAppointments(from: string, to: string): Promise<Appointment[]> {
  await delay();
  const doctor = requireRole('doctor');
  return copy(
    db.appointments
      .filter((a) => a.doctorId === doctor.id && a.date >= from && a.date <= to)
      .sort(byDateTime)
      .map(toAppointment),
  );
}

// GET /api/doctor/availability
export async function getMyAvailability(): Promise<AvailabilityRule[]> {
  await delay();
  const doctor = requireRole('doctor');
  return copy(
    db.availability
      .filter((r) => r.doctorId === doctor.id)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
      .map(({ dayOfWeek, startTime, endTime, slotMinutes }) => ({ dayOfWeek, startTime, endTime, slotMinutes })),
  );
}

// PUT /api/doctor/availability — replaces the whole weekly schedule.
export async function saveMyAvailability(rules: AvailabilityRule[]): Promise<void> {
  await delay();
  const doctor = requireRole('doctor');

  for (const rule of rules) {
    if (toMinutes(rule.startTime) >= toMinutes(rule.endTime)) throw new ApiError(400, 'Start time must be before end time.');
    if (rule.slotMinutes < 5 || rule.slotMinutes > 240) throw new ApiError(400, 'Slot length must be between 5 and 240 minutes.');
  }
  // Windows on the same day must not overlap.
  for (const a of rules) {
    for (const b of rules) {
      if (a !== b && a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && b.startTime < a.endTime) {
        throw new ApiError(400, 'Working hours on the same day overlap.');
      }
    }
  }

  db.availability = db.availability.filter((r) => r.doctorId !== doctor.id);
  for (const rule of rules) db.availability.push({ id: nextId('availability'), doctorId: doctor.id, ...rule });
}

// POST /api/doctor/appointments — manual (phone) appointment or blocked time.
// input.doctorId is ignored: the server always uses the logged-in doctor.
export async function createDoctorAppointment(input: StaffAppointmentInput): Promise<Appointment> {
  await delay();
  const doctor = requireRole('doctor');
  const row = createStaffAppointment({ ...input, doctorId: doctor.id }, doctor.id);
  return copy(toAppointment(row));
}

// PATCH /api/doctor/appointments/:id/cancel — only appointments in your own schedule.
export async function cancelDoctorAppointment(id: number): Promise<void> {
  await delay();
  const doctor = requireRole('doctor');
  const row = db.appointments.find((a) => a.id === id && a.doctorId === doctor.id);
  if (!row) throw new ApiError(404, 'Appointment not found.');
  if (row.status !== 'active') throw new ApiError(400, 'This appointment is already cancelled.');
  if (isPast(row.date, row.time)) throw new ApiError(400, 'Past appointments cannot be cancelled.');
  cancelAndNotify(row, 'Please book another time.');
}
