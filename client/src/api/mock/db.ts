// In-memory mock database with fake data. It follows the tables in
// ARCHITECTURE.md (section 6) and resets on every page reload.
// Only the logged-in user id survives a reload (localStorage).

import type { AppointmentKind, AppointmentStatus, Role } from '../../types';
import { addDays, clinicToday, dayOfWeek } from '../../utils/dates';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password: string; // mock only: the real backend stores a bcrypt hash
  role: Role;
  specialty: string | null;
  isActive: boolean;
}

export interface InvitationRow {
  id: number;
  email: string;
  name: string;
  specialty: string;
  token: string; // mock only: the real backend stores only a hash of the token
  expiresAt: string;
  usedAt: string | null;
  invitedBy: number;
}

export interface PasswordResetRow {
  id: number;
  userId: number;
  token: string; // mock only: the real backend stores only a hash of the token
  expiresAt: string;
  usedAt: string | null;
}

export interface AvailabilityRow {
  id: number;
  doctorId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

export interface AppointmentRow {
  id: number;
  doctorId: number;
  kind: AppointmentKind;
  patientId: number | null;
  guestName: string | null;
  guestPhone: string | null;
  note: string | null;
  createdBy: number;
  date: string;
  time: string;
  durationMinutes: number;
  status: AppointmentStatus;
  reminderSent: boolean;
  createdAt: string;
}

// Every seeded account uses the same password to keep testing simple.
export const DEMO_PASSWORD = 'password123';

const users: UserRow[] = [
  { id: 1, name: 'Clinic Admin', email: 'admin@clinic.test', password: DEMO_PASSWORD, role: 'admin', specialty: null, isActive: true },
  { id: 2, name: 'Dr. Maria Papadopoulou', email: 'maria@clinic.test', password: DEMO_PASSWORD, role: 'doctor', specialty: 'Cardiology', isActive: true },
  { id: 3, name: 'Dr. Nikos Georgiou', email: 'nikos@clinic.test', password: DEMO_PASSWORD, role: 'doctor', specialty: 'Dermatology', isActive: true },
  { id: 4, name: 'Dr. Eleni Ioannou', email: 'eleni@clinic.test', password: DEMO_PASSWORD, role: 'doctor', specialty: 'Pediatrics', isActive: false },
  { id: 5, name: 'John Smith', email: 'john@example.com', password: DEMO_PASSWORD, role: 'patient', specialty: null, isActive: true },
  { id: 6, name: 'Anna Lee', email: 'anna@example.com', password: DEMO_PASSWORD, role: 'patient', specialty: null, isActive: true },
];

const availability: AvailabilityRow[] = [
  // Maria: Mon–Fri mornings, 30-minute slots
  ...[1, 2, 3, 4, 5].map((day, i) => ({ id: i + 1, doctorId: 2, dayOfWeek: day, startTime: '09:00', endTime: '14:00', slotMinutes: 30 })),
  // Nikos: Mon/Wed afternoons, Sat morning, 20-minute slots
  { id: 6, doctorId: 3, dayOfWeek: 1, startTime: '16:00', endTime: '20:00', slotMinutes: 20 },
  { id: 7, doctorId: 3, dayOfWeek: 3, startTime: '16:00', endTime: '20:00', slotMinutes: 20 },
  { id: 8, doctorId: 3, dayOfWeek: 6, startTime: '10:00', endTime: '13:00', slotMinutes: 20 },
  // Eleni (inactive)
  { id: 9, doctorId: 4, dayOfWeek: 2, startTime: '09:00', endTime: '13:00', slotMinutes: 30 },
];

// Next date (from tomorrow on) that falls on the given weekday.
function nextWeekday(day: number, weeksAhead = 0): string {
  let date = addDays(clinicToday(), 1);
  while (dayOfWeek(date) !== day) date = addDays(date, 1);
  return addDays(date, weeksAhead * 7);
}

function seedAppointments(): AppointmentRow[] {
  const now = new Date().toISOString();
  const base = { note: null, reminderSent: false, createdAt: now, status: 'active' as AppointmentStatus };
  const online = (id: number, doctorId: number, patientId: number, date: string, time: string, duration: number): AppointmentRow => ({
    ...base, id, doctorId, kind: 'online', patientId, guestName: null, guestPhone: null, createdBy: patientId, date, time, durationMinutes: duration,
  });
  const tue = nextWeekday(2);
  const wed = nextWeekday(3);
  return [
    online(1, 2, 5, tue, '09:30', 30),
    online(2, 2, 6, tue, '10:00', 30),
    { ...base, id: 3, doctorId: 2, kind: 'manual', patientId: null, guestName: 'George Pappas', guestPhone: '+30 690 000 0001', createdBy: 2, date: tue, time: '11:00', durationMinutes: 30 },
    { ...base, id: 4, doctorId: 2, kind: 'block', patientId: null, guestName: null, guestPhone: null, note: 'Lunch break', createdBy: 2, date: tue, time: '12:00', durationMinutes: 60 },
    online(5, 3, 5, wed, '16:20', 20),
    { ...online(6, 2, 5, nextWeekday(4), '09:00', 30), status: 'cancelled' },
    // Past appointment, kept as history
    online(7, 2, 5, addDays(clinicToday(), -7), '10:00', 30),
    // Future appointments of the inactive doctor were cancelled when she was deactivated
    { ...online(8, 4, 6, nextWeekday(2, 1), '09:00', 30), status: 'cancelled' },
  ];
}

const in48Hours = () => new Date(Date.now() + 48 * 3600_000).toISOString();

const invitations: InvitationRow[] = [
  // Known token so the Accept invite page can be tried without sending an invitation first:
  // /accept-invite?token=demo-invite
  { id: 1, email: 'sofia@clinic.test', name: 'Dr. Sofia Dimitriou', specialty: 'Orthopedics', token: 'demo-invite', expiresAt: in48Hours(), usedAt: null, invitedBy: 1 },
];

export const db = {
  users,
  availability,
  appointments: seedAppointments(),
  invitations,
  passwordResets: [] as PasswordResetRow[],
  nextIds: { users: 7, availability: 10, appointments: 9, invitations: 2, passwordResets: 1 },
};

export function nextId(table: keyof typeof db.nextIds): number {
  return db.nextIds[table]++;
}

// ---- Fake session (stands in for the httpOnly session cookie) ----

const SESSION_KEY = 'mock-session-user-id';

let sessionUserId: number | null = (() => {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? Number(stored) : null;
  } catch {
    return null;
  }
})();

export function getSessionUserId(): number | null {
  return sessionUserId;
}

export function setSessionUserId(id: number | null): void {
  sessionUserId = id;
  try {
    if (id === null) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, String(id));
  } catch {
    // Storage blocked (e.g. private mode): the session just won't survive a reload.
  }
}

export function randomToken(): string {
  return crypto.randomUUID().replaceAll('-', '');
}
