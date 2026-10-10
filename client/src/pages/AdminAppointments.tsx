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
import { useStaffCancel } from '../hooks/useStaffCancel';
import type { Doctor, StaffAppointmentInput } from '../types';

export default function AdminAppointments() {
  const { filters, update, clear, isFiltered, page, busy, error: loadError, reload } = useAppointmentList(getAllAppointments);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsError, setDoctorsError] = useState(''); // only the doctor filter and the form need the list
  const [showForm, setShowForm] = useState(false);
  const { handleCancel, cancellingId } = useStaffCancel({ cancel: cancelAnyAppointment, onCancelled: reload, showDoctor: true });

  useEffect(() => {
    getAllDoctors()
      .then(setDoctors)
      .catch((err) => setDoctorsError(getErrorMessage(err)));
  }, []);

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

        <Alert type="error">{loadError}</Alert>
        <Alert type="error">{doctorsError && `Could not load the list of doctors: ${doctorsError}`}</Alert>
        {!loadError && (
          <AppointmentResults
            page={page}
            busy={busy}
            isFiltered={isFiltered}
            onClear={clear}
            showDoctor
            onCancel={handleCancel}
            cancellingId={cancellingId}
            onPageChange={(p) => update({ page: p })}
          />
        )}
      </Card>
    </div>
  );
}
