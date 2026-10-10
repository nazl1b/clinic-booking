// Table of appointments shared by the patient, doctor and admin pages.
// Columns are switched on/off per page. For a single day it can also list the
// free times between the appointments, so the whole day is visible at once.

import type { ReactNode } from 'react';
import type { FreeSlot } from '../api/doctors';
import type { Appointment } from '../types';
import { formatDate, fromMinutes, isPast, toMinutes } from '../utils/dates';
import { VISIT_REASON_LABELS } from '../utils/reasons';
import { Badge, type BadgeTone } from './ui/Badge';
import { Button } from './ui/Button';
import { Muted } from './ui/PageHeader';
import { ActionsCell, NoValue, Table, type Column } from './ui/Table';

interface AppointmentTableProps {
  appointments: Appointment[];
  showDoctor?: boolean;
  showPatient?: boolean;
  showDate?: boolean; // default true; off for a single-day list
  showType?: boolean; // default true; off for patients (they only have online appointments)
  showStatus?: boolean; // default true; off where every row has the same status
  onCancel?: (appointment: Appointment) => void;
  cancellingId?: number | null;
  freeSlots?: FreeSlot[]; // single-day list only: free times shown between the appointments
  onAddAt?: (slot: FreeSlot) => void; // "+ Add" on a free time
  empty?: ReactNode; // shown when there is nothing to list, e.g. an EmptyState
  className?: string; // extra class on the table, e.g. fixed column widths
}

type Row = { kind: 'appointment'; time: string; appointment: Appointment } | { kind: 'free'; time: string; slot: FreeSlot };

function rowClass(a: Appointment, status: { label: string }): string | undefined {
  const classes = [
    a.status === 'cancelled' && 'row-cancelled',
    a.status !== 'cancelled' && status.label === 'Past' && 'row-muted',
    a.status !== 'cancelled' && a.kind === 'block' && 'row-block',
  ].filter(Boolean);
  return classes.length ? classes.join(' ') : undefined;
}

const KIND: Record<Appointment['kind'], { label: string; tone: BadgeTone }> = {
  online: { label: 'Online', tone: 'primary' },
  manual: { label: 'Phone', tone: 'info' },
  block: { label: 'Blocked', tone: 'warning' },
};

function statusOf(a: Appointment): { label: string; tone: BadgeTone } {
  if (a.status === 'cancelled') return { label: 'Cancelled', tone: 'danger' };
  if (isPast(a.date, a.time)) return { label: 'Past', tone: 'neutral' };
  return { label: 'Upcoming', tone: 'primary' };
}

function patientCell(a: Appointment) {
  if (a.kind === 'online') return a.patientName;
  if (a.kind === 'manual') {
    return (
      <>
        {a.guestName}
        <div className="cell-secondary">{a.guestPhone}</div>
      </>
    );
  }
  return <NoValue label="No patient" />; // blocked time
}

// The reason, with the note under it in small grey text. Blocks have no reason
// (only a note, e.g. "Lunch break"), and neither do appointments made before reasons existed.
function reasonCell(a: Appointment) {
  if (!a.reason && !a.note) return <NoValue label="No reason" />;
  if (!a.reason) return <div className="cell-secondary">{a.note}</div>;
  return (
    <>
      {VISIT_REASON_LABELS[a.reason]}
      {a.note && <div className="cell-secondary">{a.note}</div>}
    </>
  );
}

export function AppointmentTable({
  appointments,
  showDoctor,
  showPatient,
  showDate = true,
  showType = true,
  showStatus = true,
  onCancel,
  cancellingId,
  freeSlots = [],
  onAddAt,
  empty,
  className,
}: AppointmentTableProps) {
  if (appointments.length === 0 && freeSlots.length === 0) return empty ?? <Muted>No appointments.</Muted>;

  const hasActions = Boolean(onCancel || onAddAt);
  const columns: Column[] = [
    ...(showDate ? [{ label: 'Date' }] : []),
    { label: 'Time' },
    ...(showDoctor ? [{ label: 'Doctor' }] : []),
    ...(showPatient ? [{ label: 'Patient' }] : []),
    ...(showType ? [{ label: 'Type' }] : []),
    { label: 'Reason' },
    ...(showStatus ? [{ label: 'Status' }] : []),
    ...(hasActions ? [{ label: 'Actions', align: 'right' as const, hidden: true }] : []),
  ];
  // Columns a free-time row spans after the Time column.
  const freeSpan = (showDoctor ? 1 : 0) + (showPatient ? 1 : 0) + (showType ? 1 : 0) + 1 + (showStatus ? 1 : 0);

  // Free times go between the appointments, by start time. When both start at
  // the same time (a cancelled appointment freed the slot), the appointment comes first.
  const rows: Row[] = [
    ...appointments.map((a): Row => ({ kind: 'appointment', time: a.time, appointment: a })),
    ...freeSlots.map((s): Row => ({ kind: 'free', time: s.time, slot: s })),
  ];
  if (freeSlots.length > 0) rows.sort((x, y) => x.time.localeCompare(y.time) || (x.kind === 'appointment' ? -1 : 1));

  return (
    <Table columns={columns} className={className}>
      {rows.map((row) => {
        if (row.kind === 'free') {
          const slot = row.slot;
          return (
            <tr key={`free-${slot.time}`} className="row-free">
              {showDate && <td />}
              <td className="nowrap tabular">
                {slot.time}–{fromMinutes(toMinutes(slot.time) + slot.durationMinutes)}
              </td>
              <td colSpan={freeSpan}>Available</td>
              {hasActions && (
                <ActionsCell>
                  {onAddAt && (
                    <Button variant="tertiary" size="sm" onClick={() => onAddAt(slot)} aria-label={`Add an appointment at ${slot.time}`}>
                      + Add
                    </Button>
                  )}
                </ActionsCell>
              )}
            </tr>
          );
        }

        const a = row.appointment;
        const status = statusOf(a);
        const canCancel = onCancel && status.label === 'Upcoming';
        return (
          <tr key={a.id} className={rowClass(a, status)}>
            {showDate && <td className="nowrap">{formatDate(a.date)}</td>}
            <td className="nowrap tabular">
              {a.time}–{fromMinutes(toMinutes(a.time) + a.durationMinutes)}
            </td>
            {showDoctor && (
              <td>
                {a.doctorName}
                <div className="cell-secondary">{a.doctorSpecialty}</div>
              </td>
            )}
            {showPatient && <td>{patientCell(a)}</td>}
            {showType && (
              <td>
                <Badge tone={KIND[a.kind].tone}>{KIND[a.kind].label}</Badge>
              </td>
            )}
            <td>{reasonCell(a)}</td>
            {showStatus && (
              <td>
                <Badge tone={status.tone}>{status.label}</Badge>
              </td>
            )}
            {hasActions && (
              <ActionsCell>
                {canCancel && (
                  <Button variant="secondary" size="sm" danger disabled={cancellingId === a.id} onClick={() => onCancel(a)}>
                    {cancellingId === a.id ? 'Cancelling…' : a.kind === 'block' ? 'Unblock' : 'Cancel'}
                  </Button>
                )}
              </ActionsCell>
            )}
          </tr>
        );
      })}
    </Table>
  );
}
