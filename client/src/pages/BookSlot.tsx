import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { bookAppointment } from '../api/appointments';
import { ApiError, getErrorMessage } from '../api/client';
import { getDoctors, type FreeSlot } from '../api/doctors';
import { SlotPicker } from '../components/SlotPicker';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormActions } from '../components/ui/Field';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import type { Appointment, Doctor } from '../types';
import { clinicToday, formatDate } from '../utils/dates';

const backLink = (
  <ButtonLink to="/doctors" variant="tertiary" size="sm">
    ‹ All doctors
  </ButtonLink>
);

export default function BookSlot() {
  const doctorId = Number(useParams().id);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loadError, setLoadError] = useState('');
  const [date, setDate] = useState(clinicToday());
  const [slot, setSlot] = useState<FreeSlot | null>(null);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getDoctors()
      .then((doctors) => {
        const found = doctors.find((d) => d.id === doctorId);
        if (found) setDoctor(found);
        else setLoadError('Doctor not found.');
      })
      .catch((err) => setLoadError(getErrorMessage(err)));
  }, [doctorId]);

  async function handleBook() {
    if (!slot) return;
    setError('');
    setBooking(true);
    try {
      setBooked(await bookAppointment({ doctorId, date, time: slot.time }));
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
  if (!doctor) return <Muted>Loading…</Muted>;

  if (booked) {
    return (
      <div className="page">
        <PageHeader title="Appointment booked" />
        <Card>
          <Alert type="success">
            You are booked with {booked.doctorName} on {formatDate(booked.date)} at {booked.time}.
          </Alert>
          <Muted>We will email you a reminder the day before.</Muted>
          <FormActions>
            <ButtonLink to="/appointments">My appointments</ButtonLink>
            <ButtonLink to="/doctors" variant="secondary">
              Book another
            </ButtonLink>
          </FormActions>
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      {backLink}
      <PageHeader title={doctor.name} description={doctor.specialty} />
      <Card title="Choose a time">
        <SlotPicker doctorId={doctorId} date={date} onDateChange={setDate} selectedTime={slot?.time ?? null} onSelectTime={setSlot} reloadKey={reloadKey} />
        <Alert type="error">{error}</Alert>
        <div className="summary-bar">
          {slot ? (
            <span>
              {formatDate(date)} at <strong>{slot.time}</strong> ({slot.durationMinutes} min)
            </span>
          ) : (
            <span className="muted">Choose a time above.</span>
          )}
          <Button disabled={!slot || booking} onClick={handleBook}>
            {booking ? 'Booking…' : 'Book appointment'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
