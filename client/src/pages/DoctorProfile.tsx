// A doctor's page for patients (/doctors/:id): name, specialty, bio and the
// way to their free times. A deactivated or unknown doctor is "Doctor not found."

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { getDoctor } from '../api/doctors';
import { Icon } from '../components/layout/Icon';
import { Alert } from '../components/ui/Alert';
import { ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import type { Doctor } from '../types';

const backLink = (
  <ButtonLink to="/doctors" variant="tertiary" size="sm">
    <Icon name="chevronLeft" size={16} />
    All doctors
  </ButtonLink>
);

export default function DoctorProfile() {
  const doctorId = Number(useParams().id);
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
        {backLink}
        {loading ? <Muted>Loading…</Muted> : <Alert type="error">{result.error}</Alert>}
      </div>
    );
  }

  const { doctor } = result;
  return (
    <div className="page">
      {backLink}
      <PageHeader title={doctor.name} description={doctor.specialty} actions={<ButtonLink to={`/doctors/${doctor.id}/book`}>See free times</ButtonLink>} />
      {doctor.bio && (
        <Card title="About">
          <p className="doctor-bio">{doctor.bio}</p>
        </Card>
      )}
    </div>
  );
}
