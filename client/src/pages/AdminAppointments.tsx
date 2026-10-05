// Every doctor's appointments with search, filters and pages. All choices are
// kept in the URL, e.g. ?doctor=2&status=active&search=maria&page=2

import { useEffect, useState } from 'react';
import { cancelAnyAppointment, createAdminAppointment, getAllAppointments, getAllDoctors } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { AppointmentFilters } from '../components/AppointmentFilters';
import { AppointmentResults } from '../components/AppointmentResults';
import { StaffAppointmentForm } from '../components/StaffAppointmentForm';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppointmentList } from '../hooks/useAppointmentList';
import type { Appointment, Doctor, StaffAppointmentInput } from '../types';
import { formatDate } from '../utils/dates';

export default function AdminAppointments() {
  const { filters, update, clear, isFiltered, page, busy, error: loadError, reload } = useAppointmentList(getAllAppointments);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

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
      reload();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  }

  async function handleCreate(input: StaffAppointmentInput) {
    await createAdminAppointment(input);
    reload();
  }

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
        <AppointmentFilters filters={filters} onChange={update} onClear={clear} isFiltered={isFiltered} doctors={doctors} />

        <Alert type="error">{loadError || error}</Alert>
        <Alert type="success">{success}</Alert>
        <AppointmentResults
          page={page}
          busy={busy}
          isFiltered={isFiltered}
          showDoctor
          onCancel={handleCancel}
          cancellingId={cancellingId}
          onPageChange={(p) => update({ page: p })}
        />
      </Card>
    </div>
  );
}
