import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { bookAppointment } from '../api/appointments';
import { ApiError, getErrorMessage } from '../api/client';
import { getDoctors, type FreeSlot } from '../api/doctors';
import { ReasonSelect } from '../components/ReasonSelect';
import { SlotPicker } from '../components/SlotPicker';
import { Icon } from '../components/layout/Icon';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import { useFieldErrors } from '../hooks/useFieldErrors';
import { useToast } from '../hooks/useToast';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import type { Doctor, VisitReason } from '../types';
import { clinicToday, formatDate } from '../utils/dates';
import { NOTE_MAX_LENGTH } from '../utils/limits';
import { REASON_REQUIRED } from '../utils/reasons';
import { required } from '../utils/validation';

const backLink = (
  <ButtonLink to="/doctors" variant="tertiary" size="sm">
    <Icon name="chevronLeft" size={16} />
    All doctors
  </ButtonLink>
);

export default function BookSlot() {
  const doctorId = Number(useParams().id);
  const navigate = useNavigate();
  const toast = useToast();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loadError, setLoadError] = useState('');
  const [date, setDate] = useState(clinicToday());
  const [slot, setSlot] = useState<FreeSlot | null>(null);
  const [reason, setReason] = useState<VisitReason | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const { errors, validate } = useFieldErrors<'reason'>();
  const [booking, setBooking] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // A chosen time, reason or note not booked yet: leaving the page asks first.
  const allowLeaving = useUnsavedChanges(slot !== null || reason !== '' || note.trim() !== '');

  useEffect(() => {
    getDoctors()
      .then((doctors) => {
        const found = doctors.find((d) => d.id === doctorId);
        if (found) setDoctor(found);
        else setLoadError('Doctor not found.');
      })
      .catch((err) => setLoadError(getErrorMessage(err)));
  }, [doctorId]);

  async function handleBook(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slot) return;
    setError('');
    if (!validate(e.currentTarget, { reason: required(reason, REASON_REQUIRED) }) || !reason) return;
    setBooking(true);
    try {
      const booked = await bookAppointment({ doctorId, date, time: slot.time, reason, note });
      // The new appointment is listed under Upcoming in My appointments; the toast confirms it.
      toast.success(`You are booked with ${booked.doctorName} on ${formatDate(booked.date)} at ${booked.time}. We will email you a reminder the day before.`);
      allowLeaving();
      navigate('/appointments');
    } catch (err) {
      setError(getErrorMessage(err));
      // Someone else took the slot: refresh the list so it disappears.
      if (err instanceof ApiError && (err.status === 409 || err.status === 400)) {
        setSlot(null);
        setReloadKey((k) => k + 1);
      }
    } finally {
      setBooking(false);
    }
  }

  if (loadError) {
    return (
      <div className="page">
        {backLink}
        <Alert type="error">{loadError}</Alert>
      </div>
    );
  }
  if (!doctor) {
    return (
      <div className="page">
        {backLink}
        <Muted>Loading…</Muted>
      </div>
    );
  }

  return (
    <div className="page">
      {backLink}
      <PageHeader title={doctor.name} description={doctor.specialty} />
      <Card title="Choose a time" onSubmit={handleBook}>
        <SlotPicker doctorId={doctorId} date={date} onDateChange={setDate} selectedTime={slot?.time ?? null} onSelectTime={setSlot} reloadKey={reloadKey} />
        <Field label="Reason for visit" error={errors.reason}>
          <ReasonSelect value={reason} onChange={setReason} />
        </Field>
        <Field label="Note (optional)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="e.g. Symptoms or questions for the doctor" maxLength={NOTE_MAX_LENGTH} />
        </Field>
        <Alert type="error">{error}</Alert>
        <div className="summary-bar">
          {slot ? (
            <span>
              {formatDate(date)} at <strong>{slot.time}</strong> ({slot.durationMinutes} min)
            </span>
          ) : (
            <span className="muted">Choose a time above.</span>
          )}
          <Button type="submit" disabled={!slot || booking}>
            {booking ? 'Booking…' : 'Book appointment'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
