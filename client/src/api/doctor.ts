// Endpoints for the logged-in doctor: /api/doctor/*

import type { Appointment, AppointmentQuery, AvailabilityRule, Page, StaffAppointmentInput } from '../types';
import { request, toQueryString } from './client';

// GET /api/doctor/appointments?search=&status=&kind=&from=&to=&page=&pageSize=
// Only the logged-in doctor's appointments; returns one page and the total.
export function getDoctorAppointments(query: AppointmentQuery = {}): Promise<Page<Appointment>> {
  const { search, status, kind, from, to, page, pageSize } = query; // no doctor: the server uses the logged-in one
  const qs = toQueryString({ search, status, kind, from, to, page, pageSize });
  return request('GET', `/doctor/appointments${qs ? `?${qs}` : ''}`);
}

// GET /api/doctor/availability
export function getMyAvailability(): Promise<AvailabilityRule[]> {
  return request('GET', '/doctor/availability');
}

// PUT /api/doctor/availability — replaces the whole weekly schedule.
export function saveMyAvailability(rules: AvailabilityRule[]): Promise<void> {
  return request('PUT', '/doctor/availability', { body: rules });
}

// POST /api/doctor/appointments — manual (phone) appointment or blocked time.
// input.doctorId is ignored: the server always uses the logged-in doctor.
export function createDoctorAppointment(input: StaffAppointmentInput): Promise<Appointment> {
  return request('POST', '/doctor/appointments', { body: input });
}

// PATCH /api/doctor/appointments/:id/cancel — only appointments in your own schedule.
// The patient of an online appointment is emailed.
export function cancelDoctorAppointment(id: number): Promise<void> {
  return request('PATCH', `/doctor/appointments/${id}/cancel`);
}
