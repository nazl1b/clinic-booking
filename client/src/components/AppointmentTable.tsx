// Table of appointments shared by the patient, doctor and admin pages.
// Columns are switched on/off per page.

import type { ReactNode } from 'react';
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
  empty?: ReactNode; // shown when there is nothing to list, e.g. an EmptyState
  className?: string; // extra class on the table, e.g. fixed column widths
}

function rowClass(a: Appointment, status: { label: string }): string | undefined {
  const classes = [
    a.status === 'cancelled' && 'row-cancelled',
    a.status !== 'cancelled' && status.label === 'Past' && 'row-muted',
    a.status !== 'cancelled' && a.kind === 'block' && 'row-block',
  ].filter(Boolean);
  return classes.length ? classes.join(' ') : undefined;
}

// Type badges are neutral: only the Status column uses colour.
const KIND_LABELS: Record<Appointment['kind'], string> = {
  online: 'Online',
  manual: 'Phone',
  block: 'Blocked',
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
  empty,
  className,
}: AppointmentTableProps) {
  if (appointments.length === 0) return empty ?? <Muted>No appointments.</Muted>;

  const hasActions = Boolean(onCancel);
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
  return (
    <Table columns={columns} className={className}>
      {appointments.map((a) => {
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
                <Badge tone="neutral">{KIND_LABELS[a.kind]}</Badge>
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
