// Doctor directory and free slots: /api/doctors

import type { Doctor } from '../types';
import { request } from './client';

export interface FreeSlot {
  time: string; // "HH:MM", clinic time
  durationMinutes: number;
}

// GET /api/doctors — patients; active doctors only.
export function getDoctors(): Promise<Doctor[]> {
  return request('GET', '/doctors');
}

// GET /api/doctors/:id/slots?date=YYYY-MM-DD
// Any logged-in role. Patients use it to book; doctors and admins use the same
// free slots for manual appointments (ARCHITECTURE.md section 9).
// A doctor may only ask for their own slots. Patients only see active doctors:
// a deactivated doctor is a 404 for them, like a doctor that does not exist.
export function getDoctorSlots(doctorId: number, date: string): Promise<FreeSlot[]> {
  return request('GET', `/doctors/${doctorId}/slots?date=${encodeURIComponent(date)}`);
}
