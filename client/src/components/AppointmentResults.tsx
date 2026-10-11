// Result of an appointment search: one page of the table and the page buttons
// (how many match is in the toolbar above, from useAppointmentList).
// Shared by the doctor's and the admin's Appointments pages.

import type { Appointment, Page } from '../types';
import { AppointmentTable } from './AppointmentTable';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { Muted } from './ui/PageHeader';
import { Pagination } from './ui/Pagination';

interface AppointmentResultsProps {
  page: Page<Appointment> | null; // null until the first page has loaded
  busy: boolean; // a newer page is loading: the current one is dimmed
  isFiltered: boolean;
  onClear: () => void; // "Clear filters" when nothing matches
  showDoctor?: boolean; // admin: several doctors in one list
  onCancel: (appointment: Appointment) => void;
  cancellingId: number | null;
  onPageChange: (page: number) => void;
}

export function AppointmentResults({ page, busy, isFiltered, onClear, showDoctor, onCancel, cancellingId, onPageChange }: AppointmentResultsProps) {
  if (page === null) return <Muted>Loading…</Muted>;

  return (
    <div className={`results${busy ? ' results-busy' : ''}`} aria-busy={busy}>
      <AppointmentTable
        appointments={page.items}
        showDoctor={showDoctor}
        showPatient
        onCancel={onCancel}
        cancellingId={cancellingId}
        empty={
          isFiltered ? (
            <EmptyState
              icon="search"
              title="No appointments match these filters"
              text="Try another search or other filters."
              action={
                <Button variant="secondary" onClick={onClear}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState icon="calendar" title="No upcoming appointments" text="New bookings will appear here." />
          )
        }
      />
      <Pagination page={page.page} pageSize={page.pageSize} total={page.total} onChange={onPageChange} />
    </div>
  );
}
