// The doctor's day: the appointments with the free times between them
// (?date=2026-10-06). Searching and filtering all appointments is on the
// Appointments page (/doctor/appointments).

import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { cancelDoctorAppointment, createDoctorAppointment, getDoctorAppointments } from '../api/doctor';
import { getDoctorSlots, type FreeSlot } from '../api/doctors';
import { AppointmentTable } from '../components/AppointmentTable';
import { DayNav } from '../components/DayNav';
import { StaffAppointmentForm } from '../components/StaffAppointmentForm';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import type { Appointment, StaffAppointmentInput } from '../types';
import { clinicToday, formatDate } from '../utils/dates';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function DoctorSchedule() {
  const { user } = useAuth();
  const doctorId = user?.id;
  const [params, setParams] = useSearchParams();
  const dateParam = params.get('date') ?? '';
  const date = DATE.test(dateParam) ? dateParam : clinicToday();

  // The result remembers which request it belongs to; while that differs from
  // the current request, a newer day is on its way (the old one stays visible, dimmed).
  const [reloadKey, setReloadKey] = useState(0);
  const dayKey = `${doctorId}|${date}|${reloadKey}`;
  const [day, setDay] = useState<{ key: string; appointments: Appointment[]; freeSlots: FreeSlot[] } | null>(null);
  const busy = day?.key !== dayKey;
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formStart, setFormStart] = useState<{ date: string; slot: FreeSlot } | null>(null); // from "+ Add"

  const reload = () => setReloadKey((k) => k + 1);
  const listView = params.get('view') === 'list';

  // All of the day's appointments plus its free times.
  useEffect(() => {
    if (listView || doctorId === undefined) return;
    let ignore = false;
    Promise.all([getDoctorAppointments({ from: date, to: date, pageSize: 100 }), getDoctorSlots(doctorId, date)])
      .then(([found, free]) => !ignore && setDay({ key: dayKey, appointments: found.items, freeSlots: free }))
      .catch((err) => !ignore && setError(getErrorMessage(err)));
    return () => {
      ignore = true;
    };
  }, [listView, date, doctorId, dayKey]);

  // Old links to the list view (?view=list&…) moved to the Appointments page.
  if (listView) {
    const rest = new URLSearchParams(params);
    rest.delete('view');
    rest.delete('date');
    const query = rest.toString();
    return <Navigate to={`/doctor/appointments${query ? `?${query}` : ''}`} replace />;
  }

  function setDate(d: string) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (d === clinicToday()) next.delete('date');
      else next.set('date', d);
      return next;
    });
  }

  function openForm(start: { date: string; slot: FreeSlot } | null) {
    setFormStart(start);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // the form opens above the schedule
  }

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
      reload();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  }

  async function handleCreate(input: StaffAppointmentInput) {
    await createDoctorAppointment(input);
    reload();
  }

  const active = (day?.appointments ?? []).filter((a) => a.status === 'active' && a.kind !== 'block').length;

  return (
    <div className="page">
      <PageHeader
        title="My schedule"
        actions={
          !showForm && (
            <Button variant="secondary" onClick={() => openForm(null)}>
              Phone appointment / block time
            </Button>
          )
        }
      />

      {/* The key restarts the form when "+ Add" is used on another free time */}
      {showForm && user && (
        <StaffAppointmentForm
          key={formStart ? `${formStart.date}|${formStart.slot.time}` : 'new'}
          doctorId={user.id}
          initialDate={formStart?.date}
          initialSlot={formStart?.slot}
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}

      <Card>
        <div className="toolbar">
          <DayNav date={date} onChange={setDate} />
        </div>

        <Alert type="error">{error}</Alert>
        <Alert type="success">{success}</Alert>

        {day === null ? (
          <Muted>Loading…</Muted>
        ) : (
          <div className={`results${busy ? ' results-busy' : ''}`} aria-busy={busy}>
            <Muted>
              {active} active appointment{active === 1 ? '' : 's'} · {day.freeSlots.length} free time{day.freeSlots.length === 1 ? '' : 's'}
            </Muted>
            <AppointmentTable
              appointments={day.appointments}
              showPatient
              showDate={false}
              onCancel={handleCancel}
              cancellingId={cancellingId}
              freeSlots={day.freeSlots}
              onAddAt={(slot) => openForm({ date, slot })}
              emptyText="No appointments on this day."
            />
          </div>
        )}
      </Card>
    </div>
  );
}
