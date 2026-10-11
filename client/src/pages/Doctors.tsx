import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { getDoctors } from '../api/doctors';
import { FilterToolbar } from '../components/FilterToolbar';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Field } from '../components/ui/Field';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import type { Doctor } from '../types';
import { initialOf } from '../utils/text';

export default function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [error, setError] = useState('');
  // Search and specialty are in the URL (?search=…&specialty=…), like the other lists.
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const specialty = params.get('specialty') ?? ''; // '' = all specialties
  const setParam = useCallback(
    (name: 'search' | 'specialty', value: string, options: { replace?: boolean } = {}) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value.trim()) next.set(name, value.trim());
          else next.delete(name);
          return next;
        },
        { replace: options.replace },
      ),
    [setParams],
  );
  const onSearch = useCallback((value: string) => setParam('search', value, { replace: true }), [setParam]);
  const clearAll = () => setParams((current) => {
    const next = new URLSearchParams(current);
    next.delete('search');
    next.delete('specialty');
    return next;
  });

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

      {doctors?.length !== 0 && (
        <FilterToolbar
          searchLabel="Search doctors"
          placeholder="Search by name or specialty"
          search={search}
          onSearch={onSearch}
          activeFilters={specialty ? 1 : 0}
          onClearFilters={() => setParam('specialty', '')}
        >
          <Field label="Specialty">
            <select value={specialty} onChange={(e) => setParam('specialty', e.target.value)}>
              <option value="">All specialties</option>
              {specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </FilterToolbar>
      )}

      <Alert type="error">{error}</Alert>
      {!doctors && !error && <Muted>Loading doctors…</Muted>}
      {doctors?.length === 0 && <EmptyState icon="users" title="No doctors yet" text="There are no doctors to book with yet. Please check again later." />}
      {doctors && doctors.length > 0 && visible.length === 0 && (
        <EmptyState
          icon="search"
          title="No doctors found"
          text={
            <>
              No doctors match “{search.trim()}”{specialty && ` in ${specialty}`}.
            </>
          }
          action={
            <Button variant="secondary" onClick={clearAll}>
              Clear filters
            </Button>
          }
        />
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
