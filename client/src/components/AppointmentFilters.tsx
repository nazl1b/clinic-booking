// Search box and filters above the doctor's and admin's appointment lists.
// The values live in the URL (see useAppointmentFilters); typing in the search
// box updates the URL after a short pause instead of on every key.

import { useEffect, useState } from 'react';
import type { AppointmentFilters as Filters } from '../hooks/useAppointmentFilters';
import type { Doctor } from '../types';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { SearchInput } from './ui/SearchInput';

const SEARCH_DELAY_MS = 300;

interface AppointmentFiltersProps {
  filters: Filters;
  onChange: (changes: Partial<Filters>, options?: { replace?: boolean }) => void;
  onClear: () => void;
  isFiltered: boolean;
  doctors?: Doctor[]; // admin: filter by doctor
}

export function AppointmentFilters({ filters, onChange, onClear, isFiltered, doctors }: AppointmentFiltersProps) {
  const [search, setSearch] = useState(filters.search);

  // Follow the URL when it changes from outside (Clear filters, Back button).
  const [urlSearch, setUrlSearch] = useState(filters.search);
  if (filters.search !== urlSearch) {
    setUrlSearch(filters.search);
    setSearch(filters.search);
  }

  useEffect(() => {
    if (search.trim() === filters.search.trim()) return;
    // replace: typing should not add one history entry per search
    const timer = setTimeout(() => onChange({ search }, { replace: true }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, filters.search, onChange]);

  return (
    <div className="toolbar filters" role="search">
      <SearchInput
        label="Search appointments"
        className="filters-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search patient name, phone or email"
      />
      <select value={filters.status} onChange={(e) => onChange({ status: e.target.value as Filters['status'] })} aria-label="Status">
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <select value={filters.kind} onChange={(e) => onChange({ kind: e.target.value as Filters['kind'] })} aria-label="Type">
        <option value="">All types</option>
        <option value="online">Online</option>
        <option value="manual">Phone</option>
        <option value="block">Blocked</option>
      </select>
      {doctors && (
        <select
          value={filters.doctorId ?? ''}
          onChange={(e) => onChange({ doctorId: e.target.value ? Number(e.target.value) : null })}
          aria-label="Doctor"
        >
          <option value="">All doctors</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.isActive ? '' : ' (deactivated)'}
            </option>
          ))}
        </select>
      )}
      <Field label="From" inline>
        <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => onChange({ from: e.target.value })} />
      </Field>
      <Field label="To" inline>
        <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => onChange({ to: e.target.value })} />
      </Field>
      {isFiltered && (
        <Button variant="tertiary" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
