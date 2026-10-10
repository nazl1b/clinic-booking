// Shared types. They mirror the JSON shapes the REST API will return.

export type Role = 'patient' | 'doctor' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  specialty: string | null; // doctors only
  bio: string | null; // doctors only
  isActive: boolean;
}

export interface Doctor {
  id: number;
  name: string;
  email: string;
  specialty: string;
  bio: string | null; // short text for patients, null = none
  isActive: boolean;
}

// One weekly working window, e.g. Monday 09:00–14:00 in 30-minute slots.
export interface AvailabilityRule {
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  slotMinutes: number;
}

export type AppointmentKind = 'online' | 'manual' | 'block';
export type AppointmentStatus = 'active' | 'cancelled';
// Labels in utils/reasons.ts
export type VisitReason = 'first_visit' | 'follow_up' | 'check_up' | 'test_results' | 'other';

export interface Appointment {
  id: number;
  doctorId: number;
  doctorName: string;
  doctorSpecialty: string;
  kind: AppointmentKind;
  patientId: number | null; // online only
  patientName: string | null; // online only
  guestName: string | null; // manual only
  guestPhone: string | null; // manual only
  reason: VisitReason | null; // online and manual; null on blocks and on appointments made before reasons existed
  note: string | null;
  date: string; // "YYYY-MM-DD" (clinic time)
  time: string; // "HH:MM" (clinic time)
  durationMinutes: number;
  status: AppointmentStatus;
  createdAt: string; // ISO timestamp
}

// Search, filters and page for the doctor's and admin's appointment lists.
// Sent as query params, e.g. ?search=maria&status=active&page=2
export interface AppointmentQuery {
  search?: string; // patient name, phone or email
  status?: AppointmentStatus;
  kind?: AppointmentKind;
  from?: string; // "YYYY-MM-DD", inclusive
  to?: string; // "YYYY-MM-DD", inclusive
  doctorId?: number; // admin only
  page?: number; // 1-based
  pageSize?: number; // default 20, at most 100
}

// The patient's two lists on My appointments: upcoming (active, not started
// yet) and past (past or cancelled).
export type MyAppointmentsView = 'upcoming' | 'past';

// One page of a list plus the number of matching rows in total.
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Invitation {
  id: number;
  email: string;
  name: string;
  specialty: string;
  expiresAt: string; // ISO timestamp
}

// What the doctor sees when opening an invitation link.
export interface InvitationPreview {
  name: string;
  email: string;
  specialty: string;
}

// Body for a manual (phone) appointment or a blocked time.
export type StaffAppointmentInput =
  | { kind: 'manual'; doctorId: number; date: string; time: string; guestName: string; guestPhone: string; reason: VisitReason; note?: string }
  | { kind: 'block'; doctorId: number; date: string; time: string; durationMinutes: number; note?: string };

export interface PhoneContact {
  appointmentId: number;
  guestName: string;
  guestPhone: string;
  date: string;
  time: string;
}

// Returned when an admin deactivates a doctor.
export interface DeactivationResult {
  cancelledCount: number;
  emailedCount: number;
  phoneContacts: PhoneContact[]; // manual appointments the admin must call
}
