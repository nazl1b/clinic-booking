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
  { id: 7, name: 'Maria Kosta', email: 'maria.kosta@example.com', password: DEMO_PASSWORD, role: 'patient', specialty: null, isActive: true },
  { id: 8, name: 'Petros Alexiou', email: 'petros@example.com', password: DEMO_PASSWORD, role: 'patient', specialty: null, isActive: true },
  { id: 9, name: 'Sofia Nikolaou', email: 'sofia.n@example.com', password: DEMO_PASSWORD, role: 'patient', specialty: null, isActive: true },
  { id: 10, name: 'Giannis Markou', email: 'giannis.m@example.com', password: DEMO_PASSWORD, role: 'patient', specialty: null, isActive: true },
];

const availability: AvailabilityRow[] = [
  // Maria: every day, morning and afternoon/evening, 30-minute slots.
  // Wider than a real clinic on purpose, so booking can be tried at any time of day.
  ...[0, 1, 2, 3, 4, 5, 6].flatMap((day, i) => [
    { id: i * 2 + 1, doctorId: 2, dayOfWeek: day, startTime: '08:00', endTime: '14:00', slotMinutes: 30 },
    { id: i * 2 + 2, doctorId: 2, dayOfWeek: day, startTime: '15:00', endTime: '23:00', slotMinutes: 30 },
  ]),
  // Nikos: Mon/Wed afternoons, Sat morning, 20-minute slots
  { id: 15, doctorId: 3, dayOfWeek: 1, startTime: '16:00', endTime: '20:00', slotMinutes: 20 },
  { id: 16, doctorId: 3, dayOfWeek: 3, startTime: '16:00', endTime: '20:00', slotMinutes: 20 },
  { id: 17, doctorId: 3, dayOfWeek: 6, startTime: '10:00', endTime: '13:00', slotMinutes: 20 },
  // Eleni (inactive)
  { id: 18, doctorId: 4, dayOfWeek: 2, startTime: '09:00', endTime: '13:00', slotMinutes: 30 },
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
  const manual = (id: number, guestName: string, guestPhone: string, date: string, time: string, note: string | null = null): AppointmentRow => ({
    ...base, id, doctorId: 2, kind: 'manual', patientId: null, guestName, guestPhone, note, createdBy: 2, date, time, durationMinutes: 30,
  });
  const today = clinicToday();
  const tue = nextWeekday(2);
  const wed = nextWeekday(3);
  return [
    // Maria's day today, spread over morning and afternoon so the schedule always
    // has past, upcoming, phone, blocked and cancelled entries whatever the time.
    { ...online(9, 2, 5, today, '09:00', 30), note: 'Follow-up, blood pressure' },
    online(10, 2, 6, today, '10:00', 30),
    manual(11, 'Katerina Vlachou', '+30 694 123 4567', today, '11:00', 'First visit'),
    { ...base, id: 12, doctorId: 2, kind: 'block', patientId: null, guestName: null, guestPhone: null, note: 'Hospital rounds', createdBy: 2, date: today, time: '12:00', durationMinutes: 60 },
    { ...online(13, 2, 6, today, '16:00', 30), status: 'cancelled' },
    manual(14, 'Dimitris Kostas', '+30 697 555 0192', today, '17:30'),
    { ...online(15, 2, 5, today, '19:00', 30), note: 'Annual check-up' },

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

    // Enough history and future bookings to page through the appointment lists.
    ...fillerAppointments(16, base, online),
  ];
}

const FILLER_PATIENTS = [5, 6, 7, 8, 9, 10];
const FILLER_GUESTS: [string, string][] = [
  ['Eleni Papadaki', '+30 693 111 2233'],
  ['Kostas Lambrou', '+30 698 444 5566'],
  ['Maria Sotiriou', '+30 697 222 7788'],
  ['Nikos Daskalakis', '+30 694 909 1010'],
];
// Nikos: Monday 17:00, Wednesday 18:00, Saturday 10:40 (inside his working hours)
const NIKOS_FILLER_TIMES: Record<number, string> = { 1: '17:00', 3: '18:00', 6: '10:40' };

// Repeating pattern over the days around today (today itself is seeded by hand
// above). The times never overlap the hand-written appointments.
function fillerAppointments(
  firstId: number,
  base: Pick<AppointmentRow, 'note' | 'reminderSent' | 'createdAt' | 'status'>,
  online: (id: number, doctorId: number, patientId: number, date: string, time: string, duration: number) => AppointmentRow,
): AppointmentRow[] {
  const rows: AppointmentRow[] = [];
  let id = firstId;
  const today = clinicToday();

  for (let offset = -10; offset <= 20; offset++) {
    if (offset === 0) continue;
    const date = addDays(today, offset);
    const i = offset + 10;

    // Maria: one online booking every day, a phone booking every third day,
    // a short block every ninth day; every seventh booking was cancelled.
    const row = online(id++, 2, FILLER_PATIENTS[i % FILLER_PATIENTS.length], date, ['08:00', '13:30', '18:00', '20:00'][i % 4], 30);
    rows.push(i % 7 === 3 ? { ...row, status: 'cancelled' } : row);
    if (i % 3 === 0) {
      const [guestName, guestPhone] = FILLER_GUESTS[i % FILLER_GUESTS.length];
      rows.push({ ...base, id: id++, doctorId: 2, kind: 'manual', patientId: null, guestName, guestPhone, createdBy: 2, date, time: i % 2 ? '21:00' : '15:00', durationMinutes: 30 });
    }
    if (i % 9 === 0) {
      rows.push({ ...base, id: id++, doctorId: 2, kind: 'block', patientId: null, guestName: null, guestPhone: null, note: 'Admin time', createdBy: 2, date, time: '08:30', durationMinutes: 30 });
    }

    const nikosTime = NIKOS_FILLER_TIMES[dayOfWeek(date)];
    if (nikosTime) rows.push(online(id++, 3, FILLER_PATIENTS[(i + 2) % FILLER_PATIENTS.length], date, nikosTime, 20));
  }
  return rows;
}

const in48Hours = () => new Date(Date.now() + 48 * 3600_000).toISOString();

const invitations: InvitationRow[] = [
  // Known token so the Accept invite page can be tried without sending an invitation first:
  // /accept-invite?token=demo-invite
  { id: 1, email: 'sofia@clinic.test', name: 'Dr. Sofia Dimitriou', specialty: 'Orthopedics', token: 'demo-invite', expiresAt: in48Hours(), usedAt: null, invitedBy: 1 },
];

const appointments = seedAppointments();

export const db = {
  users,
  availability,
  appointments,
  invitations,
  passwordResets: [] as PasswordResetRow[],
  nextIds: {
    users: 11,
    availability: 19,
    appointments: Math.max(...appointments.map((a) => a.id)) + 1,
    invitations: 2,
    passwordResets: 1,
  },
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
