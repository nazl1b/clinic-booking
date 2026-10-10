// New phone appointment or blocked time, on its own page:
//   doctor: /doctor/schedule/new    (their own schedule)
//   admin:  /admin/appointments/new (any active doctor)
// The page that opened it passes in the router state where to go back to (`from`).
// Saving or cancelling goes back there.

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createAdminAppointment, getAllDoctors } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { createDoctorAppointment } from '../api/doctor';
import { Icon } from '../components/layout/Icon';
import { StaffAppointmentForm } from '../components/StaffAppointmentForm';
import { Alert } from '../components/ui/Alert';
import { ButtonLink } from '../components/ui/Button';
import { Muted } from '../components/ui/PageHeader';
import { useAuth } from '../hooks/useAuth';
import type { Doctor, StaffAppointmentInput } from '../types';

// Router state set by the page that links here.
export interface NewStaffAppointmentState {
  from?: string; // path + query to return to, e.g. "/doctor/schedule?date=2026-10-12"
}

export default function NewStaffAppointment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as NewStaffAppointmentState;
  const isAdmin = user?.role === 'admin';
  const back = state.from ?? (isAdmin ? '/admin/appointments' : '/doctor/schedule');

  // Admin only: the active doctors to choose from.
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    if (!isAdmin) return;
    getAllDoctors()
      .then((list) => setDoctors(list.filter((d) => d.isActive)))
      .catch((err) => setLoadError(getErrorMessage(err)));
  }, [isAdmin]);

  async function handleSubmit(input: StaffAppointmentInput) {
    if (isAdmin) await createAdminAppointment(input);
    else await createDoctorAppointment(input);
  }

  const goBack = () => navigate(back);
  const backLink = (
    <ButtonLink to={back} variant="tertiary" size="sm">
      <Icon name="chevronLeft" size={16} />
      {isAdmin ? 'Back to appointments' : 'Back to schedule'}
    </ButtonLink>
  );

  if (!user) return null;
  if (isAdmin && !doctors) {
    return (
      <div className="page">
        {backLink}
        {loadError ? <Alert type="error">{loadError}</Alert> : <Muted>Loading…</Muted>}
      </div>
    );
  }

  return (
    <div className="page">
      {backLink}
      <StaffAppointmentForm
        doctorId={isAdmin ? undefined : user.id}
        doctors={isAdmin ? (doctors ?? []) : undefined}
        onSubmit={handleSubmit}
        onSaved={goBack}
        onCancel={goBack}
      />
    </div>
  );
}
