// Doctor directory for patients: /api/doctors

import type { Doctor } from '../types';
import { ApiError, copy, delay } from './client';
import { db } from './mock/db';
import { requireLogin, requireRole, toDoctor } from './mock/guards';
import { computeFreeSlots, type FreeSlot } from './mock/slots';

export type { FreeSlot };

// GET /api/doctors — active doctors only.
export async function getDoctors(): Promise<Doctor[]> {
  await delay();
  requireRole('patient');
  return copy(db.users.filter((u) => u.role === 'doctor' && u.isActive).map(toDoctor));
}

// GET /api/doctors/:id/slots?date=YYYY-MM-DD
// Any logged-in role. Patients use it to book; doctors and admins use the same
// free slots for manual appointments (ARCHITECTURE.md section 9).
// A doctor may only ask for their own slots. Patients only see active doctors:
// a deactivated doctor is a 404 for them, like a doctor that does not exist.
export async function getDoctorSlots(doctorId: number, date: string): Promise<FreeSlot[]> {
  await delay(200);
  const user = requireLogin();
  if (user.role === 'doctor' && user.id !== doctorId) throw new ApiError(403, 'You can only see your own free times.');
  const doctor = db.users.find((u) => u.id === doctorId && u.role === 'doctor');
  if (!doctor || (user.role === 'patient' && !doctor.isActive)) throw new ApiError(404, 'Doctor not found.');
  return copy(computeFreeSlots(doctorId, date));
}
