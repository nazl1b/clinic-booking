// Search, filters and page of an appointment list, kept in the URL
// (?search=maria&status=cancelled&page=2), so a refresh, a shared link or the
// Back button shows the same list. Other params (e.g. `view`) are left alone.

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AppointmentKind, AppointmentQuery, AppointmentStatus } from '../types';
import { clinicToday, isIsoDate } from '../utils/dates';

export interface AppointmentFilters {
  search: string;
  status: AppointmentStatus; // 'active' by default: cancelled ones only when asked for
  kind: AppointmentKind | '';
  from: string; // '' = no lower bound
  to: string; // '' = no upper bound
  doctorId: number | null; // admin only
  page: number;
}

const FILTER_PARAMS = ['search', 'status', 'kind', 'from', 'to', 'doctor', 'page'];
const KINDS: AppointmentKind[] = ['online', 'manual', 'block'];

// Without a `from` param the list starts today; `from=` (empty) means no lower bound.
function parse(params: URLSearchParams): AppointmentFilters {
  const kind = params.get('kind') as AppointmentKind;
  const from = params.get('from');
  const to = params.get('to') ?? '';
  const doctor = Number(params.get('doctor'));
  const page = Number(params.get('page'));
  return {
    search: params.get('search') ?? '',
    status: params.get('status') === 'cancelled' ? 'cancelled' : 'active',
    kind: KINDS.includes(kind) ? kind : '',
    from: from === null ? clinicToday() : isIsoDate(from) ? from : '',
    to: isIsoDate(to) ? to : '',
    doctorId: Number.isInteger(doctor) && doctor > 0 ? doctor : null,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export function toAppointmentQuery(filters: AppointmentFilters): AppointmentQuery {
  return {
    search: filters.search.trim() || undefined,
    status: filters.status,
    kind: filters.kind || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    doctorId: filters.doctorId ?? undefined,
    page: filters.page,
  };
}

export function useAppointmentFilters() {
  const [params, setParams] = useSearchParams();
  const key = params.toString();
  // Same object while the URL does not change, so it can be an effect dependency.
  const filters = useMemo(() => parse(new URLSearchParams(key)), [key]);

  // Any change other than the page goes back to page 1.
  const update = useCallback(
    (changes: Partial<AppointmentFilters>, options: { replace?: boolean } = {}) =>
      setParams(
      (current) => {
        const next = new URLSearchParams(current);
        const write = (name: string, value: string | null) => (value === null ? next.delete(name) : next.set(name, value));
        if ('search' in changes) write('search', changes.search?.trim() || null);
        if ('status' in changes) write('status', changes.status === 'cancelled' ? 'cancelled' : null); // active is the default
        if ('kind' in changes) write('kind', changes.kind || null);
        if ('from' in changes) write('from', changes.from === clinicToday() ? null : (changes.from ?? '')); // today is the default
        if ('to' in changes) write('to', changes.to || null);
        if ('doctorId' in changes) write('doctor', changes.doctorId ? String(changes.doctorId) : null);
        write('page', changes.page && changes.page > 1 ? String(changes.page) : null);
        return next;
      },
      { replace: options.replace },
    ),
    [setParams],
  );

  const clear = useCallback(
    () =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        for (const name of FILTER_PARAMS) next.delete(name);
        return next;
      }),
    [setParams],
  );

  const isFiltered = FILTER_PARAMS.some((name) => name !== 'page' && params.has(name));

  return { filters, update, clear, isFiltered };
}
