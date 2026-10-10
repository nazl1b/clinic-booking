// Form for doctors and admins: book a phone appointment for a patient without
// an account, or block time (e.g. a break). Uses the same free slots patients see.

import { useState, type FormEvent } from 'react';
import { ApiError, getErrorMessage } from '../api/client';
import type { FreeSlot } from '../api/doctors';
import { useFieldErrors } from '../hooks/useFieldErrors';
import { useToast } from '../hooks/useToast';
import type { Doctor, StaffAppointmentInput, VisitReason } from '../types';
import { clinicToday, formatDate, formatDuration, fromMinutes, toMinutes } from '../utils/dates';
import { NAME_MAX_LENGTH, NOTE_MAX_LENGTH, PHONE_MAX_LENGTH } from '../utils/limits';
import { REASON_REQUIRED } from '../utils/reasons';
import { required } from '../utils/validation';
import { ReasonSelect } from './ReasonSelect';
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
  onSubmit: (input: StaffAppointmentInput) => Promise<void>;
  onSaved: () => void; // after the success toast, e.g. back to the schedule
  onCancel: () => void;
}

type Kind = StaffAppointmentInput['kind'];

// Lengths offered for blocked time, in slots of the doctor's appointment length.
const BLOCK_LENGTH_OPTIONS = [1, 2, 3, 4, 6, 8];

// How many free times follow each other from `start` on (itself included), inside
// the same working window: a block can only cover those. It may not overlap an
// appointment, and like the server it must stay in one window, even when the next
// window starts right where this one ends (e.g. 09:00–12:00 and 12:00–14:00).
function freeSlotsInARow(daySlots: FreeSlot[], start: FreeSlot): number {
  let count = 0;
  let next = toMinutes(start.time);
  for (const s of daySlots) {
    const time = toMinutes(s.time);
    if (time < next) continue;
    if (time !== next || s.windowEnd !== start.windowEnd) break;
    count++;
    next += s.durationMinutes;
  }
  return count;
}

export function StaffAppointmentForm({ doctorId, doctors, onSubmit, onSaved, onCancel }: StaffAppointmentFormProps) {
  const [kind, setKind] = useState<Kind>('manual');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(doctorId ?? doctors?.[0]?.id ?? null);
  const [date, setDate] = useState(clinicToday());
  const [slot, setSlot] = useState<FreeSlot | null>(null);
  const [daySlots, setDaySlots] = useState<FreeSlot[]>([]); // free times of the chosen day
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [reason, setReason] = useState<VisitReason | ''>('');
  const [blockSlots, setBlockSlots] = useState(1); // block length in slots
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { errors, validate } = useFieldErrors<'guestName' | 'guestPhone' | 'reason'>();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    // Patient name, phone and reason are only on the form for a phone appointment.
    const valid = validate(e.currentTarget, {
      guestName: kind === 'manual' ? required(guestName, "Please enter the patient's name.") : undefined,
      guestPhone: kind === 'manual' ? required(guestPhone, 'Please enter a phone number.') : undefined,
      reason: kind === 'manual' ? required(reason, REASON_REQUIRED) : undefined,
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
        await onSubmit({ ...common, kind, guestName, guestPhone, reason: reason as VisitReason }); // checked above
        toast.success(`Phone appointment for ${guestName} on ${formatDate(date)} at ${slot.time} was booked.`);
      } else {
        await onSubmit({ ...common, kind, durationMinutes: blockSlots * slot.durationMinutes });
        toast.success(`Time blocked on ${formatDate(date)} from ${slot.time}.`);
      }
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
      if (err instanceof ApiError && err.status === 409) setSlot(null);
      setReloadKey((k) => k + 1); // the free times may have changed
      setSaving(false);
    }
  }

  return (
    <Card onSubmit={handleSubmit}>
      {/* The page title is in the page's PageHeader; the type comes first in the form */}
      <div>
        <Segmented
          label="Type"
          options={[
            { value: 'manual', label: 'Phone appointment' },
            { value: 'block', label: 'Block time' },
          ]}
          value={kind}
          onChange={setKind}
        />
      </div>
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
        <SlotPicker
          doctorId={selectedDoctorId}
          date={date}
          onDateChange={setDate}
          selectedTime={slot?.time ?? null}
          onSelectTime={(chosen, free) => {
            setSlot(chosen);
            setDaySlots(free);
            setBlockSlots(1); // always fits; longer ones depend on the new time
          }}
          reloadKey={reloadKey}
        />
      )}

      {kind === 'manual' ? (
        <>
          <FormRow>
            <Field label="Patient name" error={errors.guestName}>
              <input value={guestName} onChange={(e) => setGuestName(e.target.value)} required maxLength={NAME_MAX_LENGTH} />
            </Field>
            <Field label="Phone" error={errors.guestPhone}>
              <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required maxLength={PHONE_MAX_LENGTH} />
            </Field>
          </FormRow>
          <Field label="Reason for visit" error={errors.reason}>
            <ReasonSelect value={reason} onChange={setReason} />
          </Field>
        </>
      ) : (
        <Field label="Length">
          {slot ? (
            // Only lengths that fit in the free times from the chosen one on
            <select value={blockSlots} onChange={(e) => setBlockSlots(Number(e.target.value))}>
              {BLOCK_LENGTH_OPTIONS.filter((n) => n <= freeSlotsInARow(daySlots, slot)).map((n) => (
                <option key={n} value={n}>
                  {formatDuration(n * slot.durationMinutes)} ({slot.time}–{fromMinutes(toMinutes(slot.time) + n * slot.durationMinutes)})
                </option>
              ))}
            </select>
          ) : (
            <select disabled>
              <option>Choose a time first</option>
            </select>
          )}
        </Field>
      )}

      <Field label="Note (optional)">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={kind === 'block' ? 'e.g. Lunch break' : undefined} maxLength={NOTE_MAX_LENGTH} />
      </Field>

      <Alert type="error">{error}</Alert>

      <FormActions>
        <Button type="submit" disabled={saving || !slot}>
          {saving ? 'Saving…' : kind === 'manual' ? 'Book phone appointment' : 'Block time'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </FormActions>
    </Card>
  );
}
