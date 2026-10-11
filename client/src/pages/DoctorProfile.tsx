// A doctor's page (/doctors/:id): name, specialty and bio.
// Patients: with the way to the doctor's free times; a deactivated or unknown
// doctor is "Doctor not found."
// Admins (from Doctors): any doctor, a deactivated one marked as such; no booking.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { getDoctor } from '../api/doctors';
import { Icon } from '../components/layout/Icon';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../hooks/useAuth';
import type { Doctor } from '../types';

// Back to the list the page was opened from: the patients' doctors or the admin's.
const backLink = (to: string) => (
  <ButtonLink to={to} variant="tertiary" size="sm">
    <Icon name="chevronLeft" size={16} />
    All doctors
  </ButtonLink>
);

export default function DoctorProfile() {
  const doctorId = Number(useParams().id);
  const isAdmin = useAuth().user?.role === 'admin';
  const back = backLink(isAdmin ? '/admin/doctors' : '/doctors');
  // The result remembers which doctor it belongs to, so another id starts loading again.
  const [result, setResult] = useState<{ id: number; doctor: Doctor | null; error: string } | null>(null);
  const loading = result?.id !== doctorId;

  useEffect(() => {
    let ignore = false;
    getDoctor(doctorId)
      .then((doctor) => !ignore && setResult({ id: doctorId, doctor, error: '' }))
      .catch((err) => !ignore && setResult({ id: doctorId, doctor: null, error: getErrorMessage(err) }));
    return () => {
      ignore = true;
    };
  }, [doctorId]);

  if (loading || !result.doctor) {
    return (
      <div className="page">
        {back}
        {loading ? <Muted>Loading…</Muted> : <Alert type="error">{result.error}</Alert>}
      </div>
    );
  }

  const { doctor } = result;
  return (
    <div className="page">
      {back}
      <PageHeader
        title={doctor.name}
        description={doctor.specialty}
        actions={
          isAdmin ? (
            !doctor.isActive && <Badge tone="neutral">Deactivated</Badge>
          ) : (
            <ButtonLink to={`/doctors/${doctor.id}/book`}>See free times</ButtonLink>
          )
        }
      />
      {isAdmin && !doctor.isActive && <Alert type="info">This doctor is deactivated: patients cannot see this page or book with them.</Alert>}
      {doctor.bio && (
        <Card title="About">
          <p className="doctor-bio">{doctor.bio}</p>
        </Card>
      )}
    </div>
  );
}
