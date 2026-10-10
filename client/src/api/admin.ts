// Admin endpoints: /api/admin/*

import type { Appointment, AppointmentQuery, DeactivationResult, Doctor, Invitation, Page, StaffAppointmentInput } from '../types';
import { request, toQueryString } from './client';

// GET /api/admin/doctors — including deactivated ones.
export function getAllDoctors(): Promise<Doctor[]> {
  return request('GET', '/admin/doctors');
}

// POST /api/admin/invitations — emails the doctor a link to set their own password.
// 409 if the email already has an account or a pending invitation.
export function inviteDoctor(input: { name: string; specialty: string; email: string }): Promise<Invitation> {
  return request('POST', '/admin/invitations', { body: input });
}

// GET /api/admin/invitations — pending (unused) invitations, expired ones included
// so the admin can resend them.
export function getInvitations(): Promise<Invitation[]> {
  return request('GET', '/admin/invitations');
}

// POST /api/admin/invitations/:id/resend — new token, the old link stops working.
export function resendInvitation(id: number): Promise<Invitation> {
  return request('POST', `/admin/invitations/${id}/resend`);
}

// DELETE /api/admin/invitations/:id
export function cancelInvitation(id: number): Promise<void> {
  return request('DELETE', `/admin/invitations/${id}`);
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
