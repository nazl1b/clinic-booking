// Shared types. They mirror the JSON shapes the REST API will return.

export type Role = 'patient' | 'doctor' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  specialty: string | null; // doctors only
  isActive: boolean;
}

export interface Doctor {
  id: number;
  name: string;
  email: string;
  specialty: string;
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
  note: string | null;
  date: string; // "YYYY-MM-DD" (clinic time)
  time: string; // "HH:MM" (clinic time)
  durationMinutes: number;
  status: AppointmentStatus;
  createdAt: string; // ISO timestamp
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
  | { kind: 'manual'; doctorId: number; date: string; time: string; guestName: string; guestPhone: string; note?: string }
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
