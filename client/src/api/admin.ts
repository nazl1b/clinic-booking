// Admin endpoints: /api/admin/*

import type { Appointment, AppointmentQuery, DeactivationResult, Doctor, Invitation, Page, StaffAppointmentInput } from '../types';
import { isPast } from '../utils/dates';
import { ApiError, copy, delay, toQueryString } from './client';
import { cancelAndNotify, createStaffAppointment } from './mock/actions';
import { listAppointments } from './mock/appointmentList';
import { db, getSessionUserId, nextId, randomToken, setSessionUserId, type InvitationRow } from './mock/db';
import { sendMockEmail } from './mock/emails';
import { byDateTime, normalizeEmail, requireRole, toAppointment, toDoctor } from './mock/guards';

const INVITATION_HOURS = 48;

function isPendingInvitation(i: InvitationRow): boolean {
  return i.usedAt === null && new Date(i.expiresAt) > new Date();
}

function toInvitation(i: InvitationRow): Invitation {
  return { id: i.id, email: i.email, name: i.name, specialty: i.specialty, expiresAt: i.expiresAt };
}

function emailInvitation(i: InvitationRow): void {
  sendMockEmail({
    to: i.email,
    subject: 'You are invited to join the clinic',
    body: `Hello ${i.name}, open this link within ${INVITATION_HOURS} hours to set your password.`,
    link: `/accept-invite?token=${i.token}`,
  });
}

function findDoctor(id: number) {
  const doctor = db.users.find((u) => u.id === id && u.role === 'doctor');
  if (!doctor) throw new ApiError(404, 'Doctor not found.');
  return doctor;
}

function futureActiveAppointments(doctorId: number) {
  return db.appointments.filter((a) => a.doctorId === doctorId && a.status === 'active' && !isPast(a.date, a.time));
}

// GET /api/admin/doctors — including deactivated ones.
export async function getAllDoctors(): Promise<Doctor[]> {
  await delay();
  requireRole('admin');
  return copy(
    db.users
      .filter((u) => u.role === 'doctor')
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name))
      .map(toDoctor),
  );
}

// POST /api/admin/invitations
export async function inviteDoctor(input: { name: string; specialty: string; email: string }): Promise<Invitation> {
  await delay();
  const admin = requireRole('admin');
  const name = input.name.trim();
  const specialty = input.specialty.trim();
  const email = normalizeEmail(input.email);
  if (!name || !specialty || !email.includes('@')) throw new ApiError(400, 'Please fill in name, specialty and a valid email.');
  if (db.users.some((u) => u.email === email)) throw new ApiError(409, 'A user with this email already exists.');
  if (db.invitations.some((i) => i.email === email && isPendingInvitation(i))) {
    throw new ApiError(409, 'There is already a pending invitation for this email.');
  }

  const invitation: InvitationRow = {
    id: nextId('invitations'),
    email,
    name,
    specialty,
    token: randomToken(),
    expiresAt: new Date(Date.now() + INVITATION_HOURS * 3600_000).toISOString(),
    usedAt: null,
    invitedBy: admin.id,
  };
  db.invitations.push(invitation);
  emailInvitation(invitation);
  return copy(toInvitation(invitation));
}

// GET /api/admin/invitations — pending (unused) invitations, expired ones included
// so the admin can resend them.
export async function getInvitations(): Promise<Invitation[]> {
  await delay();
  requireRole('admin');
  return copy(db.invitations.filter((i) => i.usedAt === null).map(toInvitation));
}

// POST /api/admin/invitations/:id/resend — new token, the old link stops working.
export async function resendInvitation(id: number): Promise<Invitation> {
  await delay();
  requireRole('admin');
  const invitation = db.invitations.find((i) => i.id === id && i.usedAt === null);
  if (!invitation) throw new ApiError(404, 'Invitation not found.');
  invitation.token = randomToken();
  invitation.expiresAt = new Date(Date.now() + INVITATION_HOURS * 3600_000).toISOString();
  emailInvitation(invitation);
  return copy(toInvitation(invitation));
}

// DELETE /api/admin/invitations/:id
export async function cancelInvitation(id: number): Promise<void> {
  await delay();
  requireRole('admin');
  const index = db.invitations.findIndex((i) => i.id === id && i.usedAt === null);
  if (index === -1) throw new ApiError(404, 'Invitation not found.');
  db.invitations.splice(index, 1);
}

// GET /api/admin/doctors/:id/upcoming-count
export async function getUpcomingCount(doctorId: number): Promise<number> {
  await delay(200);
  requireRole('admin');
  findDoctor(doctorId);
  return futureActiveAppointments(doctorId).filter((a) => a.kind !== 'block').length;
}

// PATCH /api/admin/doctors/:id — edit details.
export async function updateDoctor(id: number, input: { name: string; specialty: string }): Promise<Doctor> {
  await delay();
  requireRole('admin');
  const doctor = findDoctor(id);
  const name = input.name.trim();
  const specialty = input.specialty.trim();
  if (!name || !specialty) throw new ApiError(400, 'Name and specialty are required.');
  doctor.name = name;
  doctor.specialty = specialty;
  return copy(toDoctor(doctor));
}

// PATCH /api/admin/doctors/:id with { isActive: false }.
// Logs the doctor out, cancels future appointments, emails online patients and
// returns the phone appointments the admin has to call.
export async function deactivateDoctor(id: number): Promise<DeactivationResult> {
  await delay(500);
  requireRole('admin');
  const doctor = findDoctor(id);
  if (!doctor.isActive) throw new ApiError(400, 'This doctor is already deactivated.');

  doctor.isActive = false;
  if (getSessionUserId() === doctor.id) setSessionUserId(null);

  const result: DeactivationResult = { cancelledCount: 0, emailedCount: 0, phoneContacts: [] };
  for (const row of futureActiveAppointments(doctor.id).sort(byDateTime)) {
    if (cancelAndNotify(row, 'The doctor is no longer available at the clinic.')) result.emailedCount++;
    if (row.kind === 'block') continue;
    result.cancelledCount++;
    if (row.kind === 'manual') {
      result.phoneContacts.push({ appointmentId: row.id, guestName: row.guestName ?? '', guestPhone: row.guestPhone ?? '', date: row.date, time: row.time });
    }
  }
  return copy(result);
}

// PATCH /api/admin/doctors/:id with { isActive: true }.
export async function reactivateDoctor(id: number): Promise<Doctor> {
  await delay();
  requireRole('admin');
  const doctor = findDoctor(id);
  doctor.isActive = true;
  return copy(toDoctor(doctor));
}

// GET /api/admin/appointments?search=&status=&kind=&from=&to=&doctor=&page=&pageSize=
// Any doctor's appointments; returns one page and the total.
export async function getAllAppointments(query: AppointmentQuery = {}): Promise<Page<Appointment>> {
  const { search, status, kind, from, to, doctorId, page, pageSize } = query;
  const qs = toQueryString({ search, status, kind, from, to, doctor: doctorId, page, pageSize });
  await delay();
  requireRole('admin');
  return copy(listAppointments(new URLSearchParams(qs)));
}

// POST /api/admin/appointments — manual appointment or block for any doctor.
export async function createAdminAppointment(input: StaffAppointmentInput): Promise<Appointment> {
  await delay();
  const admin = requireRole('admin');
  const row = createStaffAppointment(input, admin.id);
  return copy(toAppointment(row));
}

// PATCH /api/admin/appointments/:id/cancel — any doctor's appointment.
// Emails the patient if they have an account.
export async function cancelAnyAppointment(id: number): Promise<void> {
  await delay();
  requireRole('admin');
  const row = db.appointments.find((a) => a.id === id);
  if (!row) throw new ApiError(404, 'Appointment not found.');
  if (row.status !== 'active') throw new ApiError(400, 'This appointment is already cancelled.');
  if (isPast(row.date, row.time)) throw new ApiError(400, 'Past appointments cannot be cancelled.');
  cancelAndNotify(row, 'Please book another time.');
}
