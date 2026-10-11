// Admin endpoints: /api/admin/*

import type { Appointment, AppointmentQuery, DeactivationResult, Doctor, DoctorQuery, Invitation, InvitationQuery, Page, StaffAppointmentInput } from '../types';
import { MAX_PAGE_SIZE } from '../utils/limits';
import { request, toQueryString } from './client';

// GET /api/admin/doctors?search=&status=&page=&pageSize= — including deactivated
// ones unless filtered; active first, then by name. Returns one page and the total.
export function getDoctorsPage(query: DoctorQuery = {}): Promise<Page<Doctor>> {
  const qs = toQueryString(query);
  return request('GET', `/admin/doctors${qs ? `?${qs}` : ''}`);
}

// Every doctor, all pages joined: for the doctor selects (filter, phone appointment form).
export async function getAllDoctors(): Promise<Doctor[]> {
  const first = await getDoctorsPage({ page: 1, pageSize: MAX_PAGE_SIZE });
  const pageCount = Math.ceil(first.total / first.pageSize);
  if (pageCount <= 1) return first.items;
  const rest = await Promise.all(Array.from({ length: pageCount - 1 }, (_, i) => getDoctorsPage({ page: i + 2, pageSize: MAX_PAGE_SIZE })));
  return [first, ...rest].flatMap((p) => p.items);
}

// POST /api/admin/invitations — emails the doctor a link to set their own password.
// 409 if the email already has an account or a pending invitation.
export function inviteDoctor(input: { name: string; specialty: string; email: string }): Promise<Invitation> {
  return request('POST', '/admin/invitations', { body: input });
}

// GET /api/admin/invitations?search=&page=&pageSize= — pending (unused) invitations,
// expired ones included so the admin can resend them; oldest first. One page and the total.
export function getInvitations(query: InvitationQuery = {}): Promise<Page<Invitation>> {
  const qs = toQueryString(query);
  return request('GET', `/admin/invitations${qs ? `?${qs}` : ''}`);
}

// POST /api/admin/invitations/:id/resend — new token, the old link stops working.
export function resendInvitation(id: number): Promise<Invitation> {
  return request('POST', `/admin/invitations/${id}/resend`);
}

// DELETE /api/admin/invitations/:id
export function cancelInvitation(id: number): Promise<void> {
  return request('DELETE', `/admin/invitations/${id}`);
}

// GET /api/admin/specialties — the specialties doctors and pending invitations
// already have, each once, alphabetically (suggestions for Invite and Edit).
export function getSpecialties(): Promise<string[]> {
  return request('GET', '/admin/specialties');
}

// GET /api/admin/doctors/:id/upcoming-count — upcoming appointments (blocks not counted).
export async function getUpcomingCount(doctorId: number): Promise<number> {
  const { count } = await request<{ count: number }>('GET', `/admin/doctors/${doctorId}/upcoming-count`);
  return count;
}

// PATCH /api/admin/doctors/:id — edit details. An empty bio removes it.
export function updateDoctor(id: number, input: { name: string; specialty: string; bio: string }): Promise<Doctor> {
  return request('PATCH', `/admin/doctors/${id}`, { body: input });
}

// PATCH /api/admin/doctors/:id with { isActive: false }.
// Logs the doctor out, cancels future appointments, emails online patients and
// returns the phone appointments the admin has to call.
export function deactivateDoctor(id: number): Promise<DeactivationResult> {
  return request('PATCH', `/admin/doctors/${id}`, { body: { isActive: false } });
}

// PATCH /api/admin/doctors/:id with { isActive: true }.
export function reactivateDoctor(id: number): Promise<Doctor> {
  return request('PATCH', `/admin/doctors/${id}`, { body: { isActive: true } });
}

// GET /api/admin/appointments?search=&status=&kind=&from=&to=&doctor=&page=&pageSize=
// Any doctor's appointments; returns one page and the total.
export function getAllAppointments(query: AppointmentQuery = {}): Promise<Page<Appointment>> {
  const { search, status, kind, from, to, doctorId, page, pageSize } = query;
  const qs = toQueryString({ search, status, kind, from, to, doctor: doctorId, page, pageSize });
  return request('GET', `/admin/appointments${qs ? `?${qs}` : ''}`);
}

// POST /api/admin/appointments — manual appointment or block for any doctor.
export function createAdminAppointment(input: StaffAppointmentInput): Promise<Appointment> {
  return request('POST', '/admin/appointments', { body: input });
}

// PATCH /api/admin/appointments/:id/cancel — any doctor's upcoming appointment.
// Emails the patient if they have an account.
export function cancelAnyAppointment(id: number): Promise<void> {
  return request('PATCH', `/admin/appointments/${id}/cancel`);
}
