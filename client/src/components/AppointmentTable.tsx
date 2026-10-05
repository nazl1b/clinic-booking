// Table of appointments shared by the patient, doctor and admin pages.
// Columns are switched on/off per page.

import type { Appointment } from '../types';
import { formatDate, fromMinutes, isPast, toMinutes } from '../utils/dates';
import { Badge, type BadgeTone } from './ui/Badge';
import { Button } from './ui/Button';
import { Muted } from './ui/PageHeader';
import { ActionsCell, Table, type Column } from './ui/Table';

interface AppointmentTableProps {
  appointments: Appointment[];
  showDoctor?: boolean;
  showPatient?: boolean;
  onCancel?: (appointment: Appointment) => void;
  cancellingId?: number | null;
  emptyText?: string;
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
  return <span className="muted">—</span>;
}

export function AppointmentTable({ appointments, showDoctor, showPatient, onCancel, cancellingId, emptyText }: AppointmentTableProps) {
  if (appointments.length === 0) return <Muted>{emptyText ?? 'No appointments.'}</Muted>;

  const columns: Column[] = [
    { label: 'Date' },
    { label: 'Time' },
    ...(showDoctor ? [{ label: 'Doctor' }] : []),
    ...(showPatient ? [{ label: 'Patient' }] : []),
    { label: 'Type' },
    { label: 'Note' },
    { label: 'Status' },
    ...(onCancel ? [{ label: 'Actions', align: 'right' as const, hidden: true }] : []),
  ];

  return (
    <Table columns={columns}>
      {appointments.map((a) => {
        const status = statusOf(a);
        const canCancel = onCancel && status.label === 'Upcoming';
        return (
          <tr key={a.id} className={a.status === 'cancelled' ? 'row-cancelled' : status.label === 'Past' ? 'row-muted' : undefined}>
            <td className="nowrap">{formatDate(a.date)}</td>
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
            <td>
              <Badge tone={KIND[a.kind].tone}>{KIND[a.kind].label}</Badge>
            </td>
            <td>{a.note ?? <span className="muted">—</span>}</td>
            <td>
              <Badge tone={status.tone}>{status.label}</Badge>
            </td>
            {onCancel && (
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
