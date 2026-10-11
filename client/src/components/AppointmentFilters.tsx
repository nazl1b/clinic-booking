// Search and filters above the doctor's and admin's appointment lists
// (FilterToolbar). The values live in the URL (see useAppointmentFilters).

import { useCallback, type ReactNode } from 'react';
import type { AppointmentFilters as Filters } from '../hooks/useAppointmentFilters';
import type { Doctor } from '../types';
import { clinicToday } from '../utils/dates';
import { FilterToolbar } from './FilterToolbar';
import { Field } from './ui/Field';

interface AppointmentFiltersProps {
  filters: Filters;
  onChange: (changes: Partial<Filters>, options?: { replace?: boolean }) => void;
  doctors?: Doctor[]; // admin: filter by doctor
  summary?: ReactNode; // the list's count, on the left (useAppointmentList)
}

export function AppointmentFilters({ filters, onChange, doctors, summary }: AppointmentFiltersProps) {
  const onSearch = useCallback((search: string) => onChange({ search }, { replace: true }), [onChange]);
  const today = clinicToday();

  // Filters that differ from the defaults (active, every type and doctor, from today on).
  // From–To counts as one.
  const activeFilters = [filters.status !== 'active', filters.kind !== '', filters.doctorId !== null, filters.from !== today || filters.to !== ''].filter(Boolean).length;

  return (
    <FilterToolbar
      searchLabel="Search appointments"
      placeholder="Search patient name, phone or email"
      search={filters.search}
      onSearch={onSearch}
      activeFilters={activeFilters}
      onClearFilters={() => onChange({ status: 'active', kind: '', doctorId: null, from: today, to: '' })}
      summary={summary}
    >
      <Field label="Status">
        <select value={filters.status} onChange={(e) => onChange({ status: e.target.value as Filters['status'] })}>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </Field>
      <Field label="Type">
        <select value={filters.kind} onChange={(e) => onChange({ kind: e.target.value as Filters['kind'] })}>
          <option value="">All types</option>
          <option value="online">Online</option>
          <option value="manual">Phone</option>
          <option value="block">Blocked</option>
        </select>
      </Field>
      {doctors && (
        <Field label="Doctor">
          <select value={filters.doctorId ?? ''} onChange={(e) => onChange({ doctorId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">All doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.isActive ? '' : ' (deactivated)'}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="From">
        <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => onChange({ from: e.target.value })} />
      </Field>
      <Field label="To">
        <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => onChange({ to: e.target.value })} />
      </Field>
    </FilterToolbar>
  );
}
