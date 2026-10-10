// Endpoints for the logged-in doctor: /api/doctor/*

import type { Appointment, AppointmentQuery, AvailabilityRule, Page, StaffAppointmentInput, User } from '../types';
import { MAX_PAGE_SIZE } from '../utils/limits';
import { request, toQueryString } from './client';

// GET /api/doctor/appointments?search=&status=&kind=&from=&to=&page=&pageSize=
// Only the logged-in doctor's appointments; returns one page and the total.
export function getDoctorAppointments(query: AppointmentQuery = {}): Promise<Page<Appointment>> {
  const { search, status, kind, from, to, page, pageSize } = query; // no doctor: the server uses the logged-in one
  const qs = toQueryString({ search, status, kind, from, to, page, pageSize });
  return request('GET', `/doctor/appointments${qs ? `?${qs}` : ''}`);
}

// Every appointment of one day, for the day schedule. A day rarely fills one
// page, but cancelled appointments can pile up on the same times, so the
// remaining pages are fetched too: the schedule never silently drops rows.
// The server orders by date, time and id, so the pages join without gaps.
export async function getDoctorDay(date: string): Promise<Appointment[]> {
  const query = { from: date, to: date, pageSize: MAX_PAGE_SIZE };
  const first = await getDoctorAppointments({ ...query, page: 1 });
  const pageCount = Math.ceil(first.total / first.pageSize);
  if (pageCount <= 1) return first.items;
  const rest = await Promise.all(Array.from({ length: pageCount - 1 }, (_, i) => getDoctorAppointments({ ...query, page: i + 2 })));
  return [first, ...rest].flatMap((p) => p.items);
}

// PATCH /api/doctor/profile — the doctor's own bio (empty removes it). Returns the updated user.
export function updateMyProfile(input: { bio: string }): Promise<User> {
  return request('PATCH', '/doctor/profile', { body: input });
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
