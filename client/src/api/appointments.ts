// Patient appointment endpoints: /api/appointments

import type { Appointment, MyAppointmentsView, Page, VisitReason } from '../types';
import { request, toQueryString } from './client';

// POST /api/appointments — the server re-checks the slot, never trusting the browser.
// 409 if someone else just booked it, 400 for any other time that is not free.
export function bookAppointment(input: { doctorId: number; date: string; time: string; reason: VisitReason; note?: string }): Promise<Appointment> {
  return request('POST', '/appointments', { body: input });
}

// GET /api/appointments/mine?view=&page= — one page (10) of your upcoming
// appointments (soonest first) or your past and cancelled ones (latest first).
export function getMyAppointments(view: MyAppointmentsView, page: number): Promise<Page<Appointment>> {
  return request('GET', `/appointments/mine?${toQueryString({ view, page })}`);
}

// PATCH /api/appointments/:id/cancel — only your own, future, active appointments.
export function cancelMyAppointment(id: number): Promise<void> {
  return request('PATCH', `/appointments/${id}/cancel`);
}
