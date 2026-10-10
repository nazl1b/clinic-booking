// The doctor's day: the appointments with the free times between them
// (?date=2026-10-06). Searching and filtering all appointments is on the
// Appointments page (/doctor/appointments).

import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { cancelDoctorAppointment, createDoctorAppointment, getDoctorDay } from '../api/doctor';
import { getDoctorSlots, type FreeSlot } from '../api/doctors';
import { AppointmentTable } from '../components/AppointmentTable';
import { DayNav } from '../components/DayNav';
import { StaffAppointmentForm } from '../components/StaffAppointmentForm';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { useStaffCancel } from '../hooks/useStaffCancel';
import type { Appointment, StaffAppointmentInput } from '../types';
import { clinicToday, isIsoDate } from '../utils/dates';
import { plural } from '../utils/text';

export default function DoctorSchedule() {
  const { user } = useAuth();
  const doctorId = user?.id;
  const [params, setParams] = useSearchParams();
  const dateParam = params.get('date') ?? '';
  const date = isIsoDate(dateParam) ? dateParam : clinicToday();

  // The result remembers which request it belongs to; while that differs from
  // the current request, a newer day is on its way (the old one stays visible, dimmed).
  const [reloadKey, setReloadKey] = useState(0);
  const dayKey = `${doctorId}|${date}|${reloadKey}`;
  const [day, setDay] = useState<{ key: string; appointments: Appointment[]; freeSlots: FreeSlot[] } | null>(null);
  const busy = day?.key !== dayKey;
  // Like `day`, a load error belongs to one request: another day starts clean.
  const [loadError, setLoadError] = useState<{ key: string; message: string } | null>(null);
  const dayError = loadError?.key === dayKey ? loadError.message : '';
  const [showForm, setShowForm] = useState(false);
  const [formStart, setFormStart] = useState<{ date: string; slot: FreeSlot } | null>(null); // from "+ Add"

  const reload = () => setReloadKey((k) => k + 1);
  const { handleCancel, cancellingId } = useStaffCancel({ cancel: cancelDoctorAppointment, onCancelled: reload });
  const listView = params.get('view') === 'list';

  // All of the day's appointments plus its free times.
  useEffect(() => {
    if (listView || doctorId === undefined) return;
    let ignore = false;
    Promise.all([getDoctorDay(date), getDoctorSlots(doctorId, date)])
      .then(([appointments, freeSlots]) => !ignore && setDay({ key: dayKey, appointments, freeSlots }))
      .catch((err) => !ignore && setLoadError({ key: dayKey, message: getErrorMessage(err) }));
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

        <Alert type="error">{dayError}</Alert>

        {dayError ? null : day === null ? (
          <Muted>Loading…</Muted>
        ) : (
          <div className={`results${busy ? ' results-busy' : ''}`} aria-busy={busy}>
            <Muted>
              {plural(active, 'active appointment')} · {plural(day.freeSlots.length, 'free time')}
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
