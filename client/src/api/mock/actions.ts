// Logic shared by several mock endpoints (doctor and admin routes).

import type { StaffAppointmentInput } from '../../types';
import { formatDate } from '../../utils/dates';
import { ApiError } from '../client';
import { db, nextId, type AppointmentRow } from './db';
import { sendMockEmail } from './emails';
import { canBlock, computeFreeSlots } from './slots';

// Manual (phone) appointment or blocked time, created by a doctor or an admin.
export function createStaffAppointment(input: StaffAppointmentInput, createdBy: number): AppointmentRow {
  const note = input.note?.trim() || null;
  const base = {
    id: 0,
    doctorId: input.doctorId,
    patientId: null,
    createdBy,
    date: input.date,
    time: input.time,
    status: 'active' as const,
    reminderSent: false,
    createdAt: new Date().toISOString(),
  };

  let row: AppointmentRow;
  if (input.kind === 'manual') {
    const guestName = input.guestName.trim();
    const guestPhone = input.guestPhone.trim();
    if (!guestName || !guestPhone) throw new ApiError(400, 'Patient name and phone are required.');
    const slot = computeFreeSlots(input.doctorId, input.date).find((s) => s.time === input.time);
    if (!slot) throw slotError(input.doctorId, input.date, input.time);
    row = { ...base, kind: 'manual', guestName, guestPhone, note, durationMinutes: slot.durationMinutes };
  } else {
    if (!canBlock(input.doctorId, input.date, input.time, input.durationMinutes)) {
      throw new ApiError(400, 'This period is outside working hours, in the past, or overlaps an appointment.');
    }
    row = { ...base, kind: 'block', guestName: null, guestPhone: null, note, durationMinutes: input.durationMinutes };
  }

  row.id = nextId('appointments');
  db.appointments.push(row);
  return row;
}

// 409 if someone else holds exactly this time, 400 for any other invalid time.
export function slotError(doctorId: number, date: string, time: string): ApiError {
  const taken = db.appointments.some((a) => a.doctorId === doctorId && a.date === date && a.time === time && a.status === 'active');
  return taken
    ? new ApiError(409, 'This time slot was just booked. Please choose another one.')
    : new ApiError(400, 'This time is not available.');
}

// Cancels an appointment and emails the patient if it is an online one.
// Returns true if an email was sent.
export function cancelAndNotify(row: AppointmentRow, reason: string): boolean {
  row.status = 'cancelled';
  if (row.kind !== 'online' || row.patientId === null) return false;

  const patient = db.users.find((u) => u.id === row.patientId);
  const doctor = db.users.find((u) => u.id === row.doctorId);
  if (!patient) return false;
  sendMockEmail({
    to: patient.email,
    subject: 'Your appointment was cancelled',
    body: `Hello ${patient.name}, your appointment with ${doctor?.name} on ${formatDate(row.date)} at ${row.time} was cancelled. ${reason}`,
  });
  return true;
}
