import { useCallback, useEffect, useState } from 'react';
import { cancelMyAppointment, getMyAppointments } from '../api/appointments';
import { getErrorMessage } from '../api/client';
import { AppointmentTable } from '../components/AppointmentTable';
import { Alert } from '../components/ui/Alert';
import { ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import type { Appointment } from '../types';
import { formatDate, isPast } from '../utils/dates';

export default function MyAppointments() {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const load = useCallback(() => {
    getMyAppointments()
      .then(setAppointments)
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  useEffect(load, [load]);

  async function handleCancel(appointment: Appointment) {
    if (!window.confirm(`Cancel your appointment with ${appointment.doctorName} on ${formatDate(appointment.date)} at ${appointment.time}?`)) return;
    setError('');
    setSuccess('');
    setCancellingId(appointment.id);
    try {
      await cancelMyAppointment(appointment.id);
      setSuccess('Your appointment was cancelled.');
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  }

  const upcoming = (appointments ?? []).filter((a) => a.status === 'active' && !isPast(a.date, a.time));
  const history = (appointments ?? []).filter((a) => !upcoming.includes(a)).reverse();

  return (
    <div className="page">
      <PageHeader title="My appointments" actions={<ButtonLink to="/doctors">Book appointment</ButtonLink>} />

      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>

      {!appointments ? (
        !error && <Muted>Loading…</Muted>
      ) : (
        <>
          <Card title="Upcoming">
            <AppointmentTable
              appointments={upcoming}
              showDoctor
              onCancel={handleCancel}
              cancellingId={cancellingId}
              emptyText="You have no upcoming appointments."
            />
          </Card>
          <Card title="Past and cancelled">
            <AppointmentTable appointments={history} showDoctor emptyText="Nothing here yet." />
          </Card>
        </>
      )}
    </div>
  );
}
