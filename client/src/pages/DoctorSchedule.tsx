// The doctor's day (?date=2026-10-06): its appointments and blocked times; the
// number of free times is in the counter above them. A strip of seven days shows
// how many active appointments each day has; its arrows move 7 days, also into the past.
// New appointments and blocks are made on their own page (/doctor/schedule/new).
// Searching and filtering all appointments is on the Appointments page (/doctor/appointments).

import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { cancelDoctorAppointment, getDoctorActiveAppointments, getDoctorDay } from '../api/doctor';
import { getDoctorSlots, type FreeSlot } from '../api/doctors';
import { AppointmentTable } from '../components/AppointmentTable';
import { DayStrip } from '../components/DayStrip';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { useStaffCancel } from '../hooks/useStaffCancel';
import type { Appointment } from '../types';
import { addDays, clinicToday, isIsoDate, weekStartFor } from '../utils/dates';
import { plural } from '../utils/text';
import type { NewStaffAppointmentState } from './NewStaffAppointment';

// Active appointments with a patient (blocked time does not count).
const isActiveVisit = (a: Appointment) => a.status === 'active' && a.kind !== 'block';

export default function DoctorSchedule() {
  const { user } = useAuth();
  const doctorId = user?.id;
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const dateParam = params.get('date') ?? '';
  const today = clinicToday();
  const date = isIsoDate(dateParam) ? dateParam : today;
  const weekStart = weekStartFor(date, today);
  const weekEnd = addDays(weekStart, 6);

  // The result remembers which request it belongs to; while that differs from
  // the current request, a newer day is on its way (the old one stays visible, dimmed).
  const [reloadKey, setReloadKey] = useState(0);
  const dayKey = `${doctorId}|${date}|${reloadKey}`;
  const [day, setDay] = useState<{ key: string; appointments: Appointment[]; freeSlots: FreeSlot[] } | null>(null);
  const busy = day?.key !== dayKey;
  // Like `day`, a load error belongs to one request: another day starts clean.
  const [loadError, setLoadError] = useState<{ key: string; message: string } | null>(null);
  const dayError = loadError?.key === dayKey ? loadError.message : '';

  // Active appointments per day of the seven shown, for the strip.
  const weekKey = `${doctorId}|${weekStart}|${reloadKey}`;
  const [week, setWeek] = useState<{ key: string; counts: Record<string, number> } | null>(null);
  const weekLoading = week?.key !== weekKey;

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

  // The counts of the seven days. If they fail, the strip shows no counts; the day itself still loads.
  useEffect(() => {
    if (listView || doctorId === undefined) return;
    let ignore = false;
    getDoctorActiveAppointments(weekStart, weekEnd)
      .then((appointments) => {
        if (ignore) return;
        const counts: Record<string, number> = {};
        for (const a of appointments.filter(isActiveVisit)) counts[a.date] = (counts[a.date] ?? 0) + 1;
        setWeek({ key: weekKey, counts });
      })
      .catch(() => !ignore && setWeek({ key: weekKey, counts: {} }));
    return () => {
      ignore = true;
    };
  }, [listView, doctorId, weekStart, weekEnd, weekKey]);

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

  // The form has its own page; it comes back to this day afterwards.
  function openForm() {
    const state: NewStaffAppointmentState = { from: location.pathname + location.search };
    navigate('/doctor/schedule/new', { state });
  }

  const active = (day?.appointments ?? []).filter(isActiveVisit).length;
  const isEmptyDay = day !== null && day.appointments.length === 0; // no appointments or blocks
  const todayShown = today >= weekStart && today <= weekEnd;

  return (
    <div className="page">
      <PageHeader
        title="My schedule"
        actions={
          <Button onClick={openForm}>
            Phone appointment / block time
          </Button>
        }
      />

      <Card>
        <div className="stack-sm">
          <DayStrip
            weekStart={weekStart}
            selected={date}
            onSelect={setDate}
            onMoveWeek={(weeks) => setDate(addDays(weekStart, weeks * 7))}
            loading={weekLoading}
            statusOf={(d) => {
              const count = week?.counts[d] ?? 0;
              return { label: count > 0 ? `${count} appt${count === 1 ? '' : 's'}` : 'None', description: plural(count, 'active appointment'), empty: count === 0 };
            }}
            actions={
              <>
                {!todayShown && (
                  <ButtonLink to="/doctor/schedule" variant="tertiary" size="sm">
                    Back to today
                  </ButtonLink>
                )}
                <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Go to date" />
              </>
            }
          />
        </div>

        <Alert type="error">{dayError}</Alert>

        {dayError ? null : day === null ? (
          <Muted>Loading…</Muted>
        ) : (
          <div className={`results${busy ? ' results-busy' : ''}`} aria-busy={busy}>
            {!isEmptyDay && (
              <Muted>
                {plural(active, 'active appointment')} · {plural(day.freeSlots.length, 'free time')}
              </Muted>
            )}
            <AppointmentTable
              appointments={day.appointments}
              showPatient
              showDate={false}
              onCancel={handleCancel}
              cancellingId={cancellingId}
              empty={<EmptyState icon="calendar" title="No appointments on this day" text="There are no bookings or blocked times on this day." />}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
