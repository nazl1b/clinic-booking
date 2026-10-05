import { useCallback, useEffect, useState } from 'react';
import { cancelAnyAppointment, createAdminAppointment, getAllAppointments, getAllDoctors } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { AppointmentTable } from '../components/AppointmentTable';
import { DateRangeNav } from '../components/DateRangeNav';
import { StaffAppointmentForm } from '../components/StaffAppointmentForm';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Checkbox, Field } from '../components/ui/Field';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import type { Appointment, Doctor, StaffAppointmentInput } from '../types';
import { clinicToday, formatDate, rangeFor, type RangeMode } from '../utils/dates';

export default function AdminAppointments() {
  const [mode, setMode] = useState<RangeMode>('week');
  const [anchor, setAnchor] = useState(clinicToday());
  const [doctorFilter, setDoctorFilter] = useState<number | 'all'>('all');
  const [hideCancelled, setHideCancelled] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { from, to } = rangeFor(mode, anchor);

  const load = useCallback(() => {
    getAllAppointments(from, to)
      .then(setAppointments)
      .catch((err) => setError(getErrorMessage(err)));
  }, [from, to]);

  useEffect(load, [load]);

  useEffect(() => {
    getAllDoctors()
      .then(setDoctors)
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  async function handleCancel(a: Appointment) {
    const question =
      a.kind === 'block'
        ? `Remove the blocked time of ${a.doctorName} on ${formatDate(a.date)} at ${a.time}?`
        : `Cancel the appointment of ${a.kind === 'online' ? a.patientName : a.guestName} with ${a.doctorName} on ${formatDate(a.date)} at ${a.time}?` +
          (a.kind === 'online' ? ' The patient will be notified by email.' : ` Please call the patient (${a.guestPhone}) to let them know.`);
    if (!window.confirm(question)) return;

    setError('');
    setSuccess('');
    setCancellingId(a.id);
    try {
      await cancelAnyAppointment(a.id);
      setSuccess(a.kind === 'block' ? 'Blocked time removed.' : a.kind === 'online' ? 'Appointment cancelled. The patient was emailed.' : 'Appointment cancelled.');
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  }

  async function handleCreate(input: StaffAppointmentInput) {
    await createAdminAppointment(input);
    load();
  }

  const visible = (appointments ?? []).filter(
    (a) => (doctorFilter === 'all' || a.doctorId === doctorFilter) && (!hideCancelled || a.status === 'active'),
  );
  const activeDoctors = doctors.filter((d) => d.isActive);

  return (
    <div className="page">
      <PageHeader
        title="All appointments"
        actions={
          !showForm && (
            <Button variant="secondary" onClick={() => setShowForm(true)} disabled={doctors.length === 0}>
              Phone appointment / block time
            </Button>
          )
        }
      />

      {showForm && <StaffAppointmentForm doctors={activeDoctors} onSubmit={handleCreate} onClose={() => setShowForm(false)} />}

      <Card>
        <DateRangeNav
          mode={mode}
          anchor={anchor}
          onChange={(m, a) => {
            setMode(m);
            setAnchor(a);
          }}
        />
        <div className="toolbar">
          <Field label="Doctor" inline>
            <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
              <option value="all">All doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.isActive ? '' : ' (deactivated)'}
                </option>
              ))}
            </select>
          </Field>
          <Checkbox label="Hide cancelled" checked={hideCancelled} onChange={setHideCancelled} />
        </div>

        <Alert type="error">{error}</Alert>
        <Alert type="success">{success}</Alert>
        {appointments === null ? (
          <Muted>Loading…</Muted>
        ) : (
          <AppointmentTable
            appointments={visible}
            showDoctor
            showPatient
            onCancel={handleCancel}
            cancellingId={cancellingId}
            emptyText="No appointments in this period."
          />
        )}
      </Card>
    </div>
  );
}
