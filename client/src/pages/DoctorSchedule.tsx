import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { cancelDoctorAppointment, createDoctorAppointment, getDoctorAppointments } from '../api/doctor';
import { AppointmentTable } from '../components/AppointmentTable';
import { DateRangeNav } from '../components/DateRangeNav';
import { StaffAppointmentForm } from '../components/StaffAppointmentForm';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import type { Appointment, StaffAppointmentInput } from '../types';
import { clinicToday, formatDate, rangeFor, type RangeMode } from '../utils/dates';

export default function DoctorSchedule() {
  const { user } = useAuth();
  const [mode, setMode] = useState<RangeMode>('day');
  const [anchor, setAnchor] = useState(clinicToday());
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { from, to } = rangeFor(mode, anchor);

  const load = useCallback(() => {
    getDoctorAppointments(from, to)
      .then(setAppointments)
      .catch((err) => setError(getErrorMessage(err)));
  }, [from, to]);

  useEffect(load, [load]);

  async function handleCancel(a: Appointment) {
    const who = a.kind === 'online' ? a.patientName : a.kind === 'manual' ? a.guestName : null;
    const question =
      a.kind === 'block'
        ? `Remove the blocked time on ${formatDate(a.date)} at ${a.time}?`
        : `Cancel the appointment with ${who} on ${formatDate(a.date)} at ${a.time}?` +
          (a.kind === 'online' ? ' The patient will be notified by email.' : ' Please call the patient to let them know.');
    if (!window.confirm(question)) return;

    setError('');
    setSuccess('');
    setCancellingId(a.id);
    try {
      await cancelDoctorAppointment(a.id);
      setSuccess(a.kind === 'block' ? 'Blocked time removed.' : 'Appointment cancelled.');
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  }

  async function handleCreate(input: StaffAppointmentInput) {
    await createDoctorAppointment(input);
    load();
  }

  const active = (appointments ?? []).filter((a) => a.status === 'active' && a.kind !== 'block').length;

  return (
    <div className="page">
      <PageHeader
        title="My schedule"
        actions={
          !showForm && (
            <Button variant="secondary" onClick={() => setShowForm(true)}>
              Phone appointment / block time
            </Button>
          )
        }
      />

      {showForm && user && <StaffAppointmentForm doctorId={user.id} onSubmit={handleCreate} onClose={() => setShowForm(false)} />}

      <Card>
        <DateRangeNav
          mode={mode}
          anchor={anchor}
          onChange={(m, a) => {
            setMode(m);
            setAnchor(a);
          }}
        />
        <Alert type="error">{error}</Alert>
        <Alert type="success">{success}</Alert>
        {appointments === null ? (
          <Muted>Loading…</Muted>
        ) : (
          <>
            <Muted>
              {active} active appointment{active === 1 ? '' : 's'}
            </Muted>
            <AppointmentTable
              appointments={appointments}
              showPatient
              onCancel={handleCancel}
              cancellingId={cancellingId}
              emptyText={mode === 'day' ? 'No appointments on this day.' : 'No appointments this week.'}
            />
          </>
        )}
      </Card>
    </div>
  );
}
