// Form for doctors and admins: book a phone appointment for a patient without
// an account, or block time (e.g. a break). Uses the same free slots patients see.

import { useState, type FormEvent } from 'react';
import { ApiError, getErrorMessage } from '../api/client';
import type { FreeSlot } from '../api/doctors';
import { useFieldErrors } from '../hooks/useFieldErrors';
import type { Doctor, StaffAppointmentInput } from '../types';
import { clinicToday, formatDate } from '../utils/dates';
import { NAME_MAX_LENGTH, NOTE_MAX_LENGTH, PHONE_MAX_LENGTH } from '../utils/limits';
import { plural } from '../utils/text';
import { required } from '../utils/validation';
import { SlotPicker } from './SlotPicker';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Field, FormActions, FormRow } from './ui/Field';
import { Muted } from './ui/PageHeader';
import { Segmented } from './ui/Segmented';

interface StaffAppointmentFormProps {
  doctorId?: number; // fixed doctor (doctor's own page)
  doctors?: Doctor[]; // admin: choose any active doctor
  initialDate?: string; // e.g. "+ Add" on a free time in the day schedule
  initialSlot?: FreeSlot;
  onSubmit: (input: StaffAppointmentInput) => Promise<void>;
  onClose: () => void;
}

type Kind = StaffAppointmentInput['kind'];

// Lengths offered for blocked time, in slots of the doctor's appointment length.
const BLOCK_LENGTH_OPTIONS = [1, 2, 3, 4, 6, 8];

export function StaffAppointmentForm({ doctorId, doctors, initialDate, initialSlot, onSubmit, onClose }: StaffAppointmentFormProps) {
  const [kind, setKind] = useState<Kind>('manual');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(doctorId ?? doctors?.[0]?.id ?? null);
  const [date, setDate] = useState(initialDate ?? clinicToday());
  const [slot, setSlot] = useState<FreeSlot | null>(initialSlot ?? null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [blockSlots, setBlockSlots] = useState(1); // block length in slots
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { errors, validate } = useFieldErrors<'guestName' | 'guestPhone'>();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess('');
    // Patient name and phone are only on the form for a phone appointment.
    const valid = validate(e.currentTarget, {
      guestName: kind === 'manual' ? required(guestName, "Please enter the patient's name.") : undefined,
      guestPhone: kind === 'manual' ? required(guestPhone, 'Please enter a phone number.') : undefined,
    });
    if (!valid) return;
    if (selectedDoctorId === null || !slot) {
      setError('Please choose a time.');
      return;
    }
    setSaving(true);
    const common = { doctorId: selectedDoctorId, date, time: slot.time, note };
    try {
      if (kind === 'manual') {
        await onSubmit({ ...common, kind, guestName, guestPhone });
        setSuccess(`Phone appointment for ${guestName} on ${formatDate(date)} at ${slot.time} was booked.`);
        setGuestName('');
        setGuestPhone('');
      } else {
        await onSubmit({ ...common, kind, durationMinutes: blockSlots * slot.durationMinutes });
        setSuccess(`Time blocked on ${formatDate(date)} from ${slot.time}.`);
      }
      setNote('');
      setSlot(null);
    } catch (err) {
      setError(getErrorMessage(err));
      if (err instanceof ApiError && err.status === 409) setSlot(null);
    } finally {
      setSaving(false);
      setReloadKey((k) => k + 1);
    }
  }

  return (
    <Card
      title="New phone appointment or blocked time"
      onSubmit={handleSubmit}
      actions={
        <Segmented
          label="Type"
          options={[
            { value: 'manual', label: 'Phone appointment' },
            { value: 'block', label: 'Block time' },
          ]}
          value={kind}
          onChange={setKind}
        />
      }
    >
      {doctors && (
        <Field label="Doctor">
          <select
            value={selectedDoctorId ?? ''}
            onChange={(e) => {
              setSelectedDoctorId(Number(e.target.value));
              setSlot(null);
            }}
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.specialty})
              </option>
            ))}
          </select>
        </Field>
      )}

      {selectedDoctorId === null ? (
        <Muted>There are no active doctors.</Muted>
      ) : (
        <SlotPicker doctorId={selectedDoctorId} date={date} onDateChange={setDate} selectedTime={slot?.time ?? null} onSelectTime={setSlot} reloadKey={reloadKey} />
      )}

      {kind === 'manual' ? (
        <FormRow>
          <Field label="Patient name" error={errors.guestName}>
            <input value={guestName} onChange={(e) => setGuestName(e.target.value)} required maxLength={NAME_MAX_LENGTH} />
          </Field>
          <Field label="Phone" error={errors.guestPhone}>
            <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required maxLength={PHONE_MAX_LENGTH} />
          </Field>
        </FormRow>
      ) : (
        <Field label="Length">
          <select value={blockSlots} onChange={(e) => setBlockSlots(Number(e.target.value))}>
            {BLOCK_LENGTH_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {slot ? plural(n * slot.durationMinutes, 'minute') : plural(n, 'slot')}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'block' ? 'e.g. Lunch break' : undefined} maxLength={NOTE_MAX_LENGTH} />
      </Field>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>

      <FormActions>
        <Button type="submit" disabled={saving || !slot}>
          {saving ? 'Saving…' : kind === 'manual' ? 'Book phone appointment' : 'Block time'}
        </Button>
        <Button variant="tertiary" onClick={onClose}>
          Close
        </Button>
      </FormActions>
    </Card>
  );
}
