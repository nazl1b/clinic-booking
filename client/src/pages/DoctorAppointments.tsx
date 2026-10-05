// All of the logged-in doctor's appointments with search, filters and pages.
// All choices are kept in the URL, e.g. ?status=active&search=maria&page=2
// The server only ever returns this doctor's own appointments.

import { useState } from 'react';
import { getErrorMessage } from '../api/client';
import { cancelDoctorAppointment, getDoctorAppointments } from '../api/doctor';
import { AppointmentFilters } from '../components/AppointmentFilters';
import { AppointmentResults } from '../components/AppointmentResults';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppointmentList } from '../hooks/useAppointmentList';
import type { Appointment } from '../types';
import { formatDate } from '../utils/dates';

export default function DoctorAppointments() {
  const { filters, update, clear, isFiltered, page, busy, error: loadError, reload } = useAppointmentList(getDoctorAppointments);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  async function handleCancel(a: Appointment) {
    const who = a.kind === 'online' ? a.patientName : a.guestName;
    const question =
      a.kind === 'block'
        ? `Remove the blocked time on ${formatDate(a.date)} at ${a.time}?`
        : `Cancel the appointment with ${who} on ${formatDate(a.date)} at ${a.time}?` +
          (a.kind === 'online' ? ' The patient will be notified by email.' : ` Please call the patient (${a.guestPhone}) to let them know.`);
    if (!window.confirm(question)) return;

    setError('');
    setSuccess('');
    setCancellingId(a.id);
    try {
      await cancelDoctorAppointment(a.id);
      setSuccess(a.kind === 'block' ? 'Blocked time removed.' : a.kind === 'online' ? 'Appointment cancelled. The patient was emailed.' : 'Appointment cancelled.');
      reload();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Appointments" description="Search and filter all your appointments." />

      <Card>
        <AppointmentFilters filters={filters} onChange={update} onClear={clear} isFiltered={isFiltered} />
        <Alert type="error">{loadError || error}</Alert>
        <Alert type="success">{success}</Alert>
        <AppointmentResults
          page={page}
          busy={busy}
          isFiltered={isFiltered}
          onCancel={handleCancel}
          cancellingId={cancellingId}
          onPageChange={(p) => update({ page: p })}
        />
      </Card>
    </div>
  );
}
