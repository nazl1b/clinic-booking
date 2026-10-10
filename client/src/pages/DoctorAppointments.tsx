// All of the logged-in doctor's appointments with search, filters and pages.
// All choices are kept in the URL, e.g. ?status=active&search=maria&page=2
// The server only ever returns this doctor's own appointments.

import { cancelDoctorAppointment, getDoctorAppointments } from '../api/doctor';
import { AppointmentFilters } from '../components/AppointmentFilters';
import { AppointmentResults } from '../components/AppointmentResults';
import { Alert } from '../components/ui/Alert';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { useAppointmentList } from '../hooks/useAppointmentList';
import { useStaffCancel } from '../hooks/useStaffCancel';

export default function DoctorAppointments() {
  const { filters, update, clear, isFiltered, page, busy, error: loadError, reload } = useAppointmentList(getDoctorAppointments);
  const { handleCancel, cancellingId } = useStaffCancel({ cancel: cancelDoctorAppointment, onCancelled: reload });

  return (
    <div className="page">
      <PageHeader title="Appointments" description="Search and filter all your appointments." />

      <Card>
        <AppointmentFilters filters={filters} onChange={update} onClear={clear} isFiltered={isFiltered} />
        <Alert type="error">{loadError}</Alert>
        {!loadError && (
          <AppointmentResults
            page={page}
            busy={busy}
            isFiltered={isFiltered}
            onCancel={handleCancel}
            cancellingId={cancellingId}
            onPageChange={(p) => update({ page: p })}
          />
        )}
      </Card>
    </div>
  );
}
