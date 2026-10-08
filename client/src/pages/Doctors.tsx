import { useEffect, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { getDoctors } from '../api/doctors';
import { Alert } from '../components/ui/Alert';
import { ButtonLink } from '../components/ui/Button';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import type { Doctor } from '../types';
import { initialOf } from '../utils/text';

export default function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getDoctors()
      .then(setDoctors)
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const query = search.trim().toLowerCase();
  const visible = (doctors ?? []).filter((d) => d.name.toLowerCase().includes(query) || d.specialty.toLowerCase().includes(query));

  return (
    <div className="page">
      <PageHeader
        title="Book an appointment"
        description="Choose a doctor to see their free times."
        actions={<input type="search" placeholder="Search by name or specialty" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search doctors" />}
      />

      <Alert type="error">{error}</Alert>
      {!doctors && !error && <Muted>Loading doctors…</Muted>}
      {doctors?.length === 0 && <Muted>There are no doctors to book with yet. Please check again later.</Muted>}
      {doctors && doctors.length > 0 && visible.length === 0 && <Muted>No doctors match “{search.trim()}”.</Muted>}

      <div className="doctor-grid">
        {visible.map((doctor) => (
          <article key={doctor.id} className="card doctor-card">
            <div className="doctor-card-head">
              <span className="avatar" aria-hidden="true">
                {initialOf(doctor.name)}
              </span>
              <div>
                <h2 className="card-title">{doctor.name}</h2>
                <p className="card-description">{doctor.specialty}</p>
              </div>
            </div>
            <ButtonLink to={`/doctors/${doctor.id}/book`} variant="secondary" block>
              See free times
            </ButtonLink>
          </article>
        ))}
      </div>
    </div>
  );
}
