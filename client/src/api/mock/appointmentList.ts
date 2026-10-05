// Mock version of the server's appointment list query: reads the query params
// exactly as the backend will (search, status, kind, from, to, doctor, page,
// pageSize), filters and sorts in the "database" and returns only the
// requested page plus the total number of matches.

import type { Appointment, Page } from '../../types';
import { ApiError } from '../client';
import { db, type AppointmentRow } from './db';
import { byDateTime, toAppointment } from './guards';

export const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const STATUSES = ['active', 'cancelled'];
const KINDS = ['online', 'manual', 'block'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function positiveInt(value: string | null, fallback: number, name: string, max = Infinity): number {
  if (value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new ApiError(400, `Invalid ${name}.`);
  return n;
}

function oneOf(value: string | null, allowed: string[], name: string): string | null {
  if (value === null || value === '') return null;
  if (!allowed.includes(value)) throw new ApiError(400, `Invalid ${name}.`);
  return value;
}

function date(value: string | null, name: string): string | null {
  if (value === null || value === '') return null;
  if (!DATE.test(value)) throw new ApiError(400, `Invalid ${name} date.`);
  return value;
}

// Patient name, email and phone. Phone numbers also match by digits only,
// so "6941234567" finds "+30 694 123 4567".
function matchesSearch(row: AppointmentRow, search: string): boolean {
  const patient = row.patientId === null ? undefined : db.users.find((u) => u.id === row.patientId);
  const haystack = [patient?.name, patient?.email, row.guestName, row.guestPhone].filter(Boolean).join(' ').toLowerCase();
  if (haystack.includes(search.toLowerCase())) return true;
  const digits = search.replace(/\D/g, '');
  return digits.length >= 3 && (row.guestPhone ?? '').replace(/\D/g, '').includes(digits);
}

// `scope.doctorId` is set for doctors: they only ever see their own schedule,
// whatever `doctor` param they send.
export function listAppointments(params: URLSearchParams, scope: { doctorId?: number } = {}): Page<Appointment> {
  const search = (params.get('search') ?? '').trim();
  const status = oneOf(params.get('status'), STATUSES, 'status');
  const kind = oneOf(params.get('kind'), KINDS, 'type');
  const from = date(params.get('from'), 'from');
  const to = date(params.get('to'), 'to');
  const doctorId = scope.doctorId ?? (params.get('doctor') ? positiveInt(params.get('doctor'), 0, 'doctor') : null);
  const page = positiveInt(params.get('page'), 1, 'page');
  const pageSize = positiveInt(params.get('pageSize'), DEFAULT_PAGE_SIZE, 'page size', MAX_PAGE_SIZE);
  if (from && to && from > to) throw new ApiError(400, 'The "from" date must be before the "to" date.');

  const matches = db.appointments
    .filter(
      (a) =>
        (doctorId === null || a.doctorId === doctorId) &&
        (status === null || a.status === status) &&
        (kind === null || a.kind === kind) &&
        (from === null || a.date >= from) &&
        (to === null || a.date <= to) &&
        (search === '' || matchesSearch(a, search)),
    )
    .sort(byDateTime);

  const start = (page - 1) * pageSize;
  return { items: matches.slice(start, start + pageSize).map(toAppointment), total: matches.length, page, pageSize };
}
