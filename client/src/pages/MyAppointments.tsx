// The patient's own appointments in two lists, Upcoming and Past and cancelled,
// each loaded from the server one page (10) at a time.

import { type ComponentProps, useState } from 'react';
import { cancelMyAppointment } from '../api/appointments';
import { getErrorMessage } from '../api/client';
import { AppointmentTable } from '../components/AppointmentTable';
import { Alert } from '../components/ui/Alert';
import { ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { useConfirm } from '../hooks/useConfirm';
import { useMyAppointments } from '../hooks/useMyAppointments';
import { useToast } from '../hooks/useToast';
import type { Appointment } from '../types';
import { formatDate } from '../utils/dates';

// One list: loading text, its error, or one page of the table with the page buttons.
// Patients only have online appointments, so there is no Type column.
type MyAppointmentListProps = Omit<ComponentProps<typeof AppointmentTable>, 'appointments'> & {
  list: ReturnType<typeof useMyAppointments>;
};

function MyAppointmentList({ list, ...tableProps }: MyAppointmentListProps) {
  if (list.error) return <Alert type="error">{list.error}</Alert>;
  if (list.page === null) return <Muted>Loading…</Muted>;
  return (
    <div className={`results${list.busy ? ' results-busy' : ''}`} aria-busy={list.busy}>
      <AppointmentTable appointments={list.page.items} showDoctor showType={false} {...tableProps} />
      <Pagination page={list.page.page} pageSize={list.page.pageSize} total={list.page.total} onChange={list.setPage} />
    </div>
  );
}

export default function MyAppointments() {
  const confirm = useConfirm();
  const toast = useToast();
  const upcoming = useMyAppointments('upcoming');
  const past = useMyAppointments('past');
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  async function handleCancel(appointment: Appointment) {
    const confirmed = await confirm({
      title: 'Cancel this appointment?',
      message: `Your appointment with ${appointment.doctorName} on ${formatDate(appointment.date)} at ${appointment.time} will be cancelled.`,
      confirmLabel: 'Cancel appointment',
      cancelLabel: 'Keep appointment',
    });
    if (!confirmed) return;
    setCancellingId(appointment.id);
    try {
      await cancelMyAppointment(appointment.id);
      toast.success('Your appointment was cancelled.');
      upcoming.reload();
      past.reload(); // the cancelled appointment moves to Past and cancelled
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  }

  // Upcoming appointments are all "Upcoming", so that table has no Status column.
  return (
    <div className="page">
      <PageHeader title="My appointments" actions={<ButtonLink to="/doctors">Book appointment</ButtonLink>} />

      <Card title="Upcoming">
        <MyAppointmentList
          list={upcoming}
          showStatus={false}
          onCancel={handleCancel}
          cancellingId={cancellingId}
          emptyText="You have no upcoming appointments."
        />
      </Card>
      <Card title="Past and cancelled">
        <MyAppointmentList list={past} emptyText="Nothing here yet." />
      </Card>
    </div>
  );
}
