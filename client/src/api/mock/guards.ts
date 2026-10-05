// Mock versions of the backend middleware (requireLogin / requireRole)
// plus the mapping from database rows to API responses.

import type { Appointment, Doctor, Role, User } from '../../types';
import { ApiError } from '../client';
import { db, getSessionUserId, type AppointmentRow, type UserRow } from './db';

export function requireLogin(): UserRow {
  const id = getSessionUserId();
  const user = id === null ? undefined : db.users.find((u) => u.id === id && u.isActive);
  if (!user) throw new ApiError(401, 'Please log in to continue.');
  return user;
}

export function requireRole(...roles: Role[]): UserRow {
  const user = requireLogin();
  if (!roles.includes(user.role)) throw new ApiError(403, 'You do not have permission to do this.');
  return user;
}

export function toUser(row: UserRow): User {
  return { id: row.id, name: row.name, email: row.email, role: row.role, specialty: row.specialty, isActive: row.isActive };
}

export function toDoctor(row: UserRow): Doctor {
  return { id: row.id, name: row.name, email: row.email, specialty: row.specialty ?? '', isActive: row.isActive };
}

export function toAppointment(row: AppointmentRow): Appointment {
  const doctor = db.users.find((u) => u.id === row.doctorId);
  const patient = row.patientId === null ? undefined : db.users.find((u) => u.id === row.patientId);
  return {
    id: row.id,
    doctorId: row.doctorId,
    doctorName: doctor?.name ?? 'Unknown doctor',
    doctorSpecialty: doctor?.specialty ?? '',
    kind: row.kind,
    patientId: row.patientId,
    patientName: patient?.name ?? null,
    guestName: row.guestName,
    guestPhone: row.guestPhone,
    note: row.note,
    date: row.date,
    time: row.time,
    durationMinutes: row.durationMinutes,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function byDateTime(a: { date: string; time: string }, b: { date: string; time: string }): number {
  return a.date.localeCompare(b.date) || a.time.localeCompare(b.time);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
