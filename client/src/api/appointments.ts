// Patient appointment endpoints: /api/appointments

import type { Appointment } from '../types';
import { request } from './client';

// POST /api/appointments — the server re-checks the slot, never trusting the browser.
// 409 if someone else just booked it, 400 for any other time that is not free.
export function bookAppointment(input: { doctorId: number; date: string; time: string }): Promise<Appointment> {
  return request('POST', '/appointments', { body: input });
}

// GET /api/appointments/mine — upcoming, past and cancelled, by date and time.
export function getMyAppointments(): Promise<Appointment[]> {
  return request('GET', '/appointments/mine');
}

// PATCH /api/appointments/:id/cancel — only your own, future, active appointments.
export function cancelMyAppointment(id: number): Promise<void> {
  return request('PATCH', `/appointments/${id}/cancel`);
}
