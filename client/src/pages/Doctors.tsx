import { useEffect, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { getDoctors } from '../api/doctors';
import { Alert } from '../components/ui/Alert';
import { ButtonLink } from '../components/ui/Button';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import { SearchInput } from '../components/ui/SearchInput';
import type { Doctor } from '../types';
import { initialOf } from '../utils/text';

export default function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState(''); // '' = all specialties

  useEffect(() => {
    getDoctors()
      .then(setDoctors)
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  // The specialties to filter by come from the doctors themselves, alphabetically.
  const specialties = [...new Set((doctors ?? []).map((d) => d.specialty))].sort((a, b) => a.localeCompare(b));
  const query = search.trim().toLowerCase();
  const visible = (doctors ?? []).filter(
    (d) => (!specialty || d.specialty === specialty) && (d.name.toLowerCase().includes(query) || d.specialty.toLowerCase().includes(query)),
  );

  return (
    <div className="page">
      <PageHeader title="Book an appointment" description="Choose a doctor to see their free times." />

      {/* Same toolbar as the appointment filters; on the right, the specialty last */}
      <div className="toolbar filters toolbar-end" role="search">
        <SearchInput label="Search doctors" placeholder="Search by name or specialty" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} aria-label="Specialty">
          <option value="">All specialties</option>
          {specialties.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <Alert type="error">{error}</Alert>
      {!doctors && !error && <Muted>Loading doctors…</Muted>}
      {doctors?.length === 0 && <Muted>There are no doctors to book with yet. Please check again later.</Muted>}
      {doctors && doctors.length > 0 && visible.length === 0 && (
        <Muted>
          No doctors match “{search.trim()}”{specialty && ` in ${specialty}`}.
        </Muted>
      )}

      <div className="doctor-grid">
        {visible.map((doctor) => (
          <article key={doctor.id} className="card doctor-card">
            <div className="doctor-card-head">
              <span className="avatar" aria-hidden="true">
                {initialOf(doctor.name)}
              </span>
              <div>
                <h2 className="card-title">
                  <ButtonLink to={`/doctors/${doctor.id}`} variant="tertiary">
                    {doctor.name}
                  </ButtonLink>
                </h2>
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
