// Patient appointment endpoints: /api/appointments

import type { Appointment } from '../types';
import { isPast } from '../utils/dates';
import { ApiError, copy, delay } from './client';
import { slotError } from './mock/actions';
import { db, nextId } from './mock/db';
import { byDateTime, requireRole, toAppointment } from './mock/guards';
import { computeFreeSlots } from './mock/slots';

// POST /api/appointments — the server re-checks the slot, never trusting the browser.
export async function bookAppointment(input: { doctorId: number; date: string; time: string }): Promise<Appointment> {
  await delay(400);
  const patient = requireRole('patient');
  const slot = computeFreeSlots(input.doctorId, input.date).find((s) => s.time === input.time);
  if (!slot) throw slotError(input.doctorId, input.date, input.time);

  const row = {
    id: nextId('appointments'),
    doctorId: input.doctorId,
    kind: 'online' as const,
    patientId: patient.id,
    guestName: null,
    guestPhone: null,
    note: null,
    createdBy: patient.id,
    date: input.date,
    time: input.time,
    durationMinutes: slot.durationMinutes,
    status: 'active' as const,
    reminderSent: false,
    createdAt: new Date().toISOString(),
  };
  db.appointments.push(row);
  return copy(toAppointment(row));
}

// GET /api/appointments/mine
export async function getMyAppointments(): Promise<Appointment[]> {
  await delay();
  const patient = requireRole('patient');
  return copy(db.appointments.filter((a) => a.patientId === patient.id).sort(byDateTime).map(toAppointment));
}

// PATCH /api/appointments/:id/cancel — only your own, future, active appointments.
export async function cancelMyAppointment(id: number): Promise<void> {
  await delay();
  const patient = requireRole('patient');
  const row = db.appointments.find((a) => a.id === id && a.patientId === patient.id);
  if (!row) throw new ApiError(404, 'Appointment not found.');
  if (row.status !== 'active') throw new ApiError(400, 'This appointment is already cancelled.');
  if (isPast(row.date, row.time)) throw new ApiError(400, 'Past appointments cannot be cancelled.');
  row.status = 'cancelled';
}
