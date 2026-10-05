// Date input + grid of free time slots for one doctor. Slots reload whenever
// the date (or doctor) changes, without a page reload.

import { useEffect, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { getDoctorSlots, type FreeSlot } from '../api/doctors';
import { clinicToday } from '../utils/dates';
import { Alert } from './ui/Alert';
import { Field } from './ui/Field';
import { Muted } from './ui/PageHeader';

interface SlotPickerProps {
  doctorId: number;
  date: string;
  onDateChange: (date: string) => void;
  selectedTime: string | null;
  onSelectTime: (slot: FreeSlot | null) => void;
  reloadKey?: number; // bump to force a reload, e.g. after a 409
}

export function SlotPicker({ doctorId, date, onDateChange, selectedTime, onSelectTime, reloadKey = 0 }: SlotPickerProps) {
  // The result remembers which request it belongs to; while it does not match
  // the current one, the slots are still loading.
  const requestKey = `${doctorId}|${date}|${reloadKey}`;
  const [result, setResult] = useState<{ key: string; slots: FreeSlot[]; error: string } | null>(null);
  const loading = result?.key !== requestKey;
  const slots = loading ? [] : result.slots;
  const error = loading ? '' : result.error;

  useEffect(() => {
    let ignore = false;
    getDoctorSlots(doctorId, date)
      .then((found) => !ignore && setResult({ key: requestKey, slots: found, error: '' }))
      .catch((err) => !ignore && setResult({ key: requestKey, slots: [], error: getErrorMessage(err) }));
    return () => {
      ignore = true;
    };
  }, [doctorId, date, requestKey]);

  return (
    <div className="stack-sm">
      <Field label="Date" inline>
        <input
          type="date"
          value={date}
          min={clinicToday()}
          required
          onChange={(e) => {
            if (!e.target.value) return;
            onDateChange(e.target.value);
            onSelectTime(null);
          }}
        />
      </Field>

      <Alert type="error">{error}</Alert>
      {loading ? (
        <Muted>Loading free times…</Muted>
      ) : slots.length === 0 ? (
        !error && <Muted>No free times on this day. Try another date.</Muted>
      ) : (
        <div className="slot-grid" role="listbox" aria-label="Free times">
          {slots.map((slot) => (
            <button
              key={slot.time}
              type="button"
              role="option"
              aria-selected={slot.time === selectedTime}
              className={`slot${slot.time === selectedTime ? ' selected' : ''}`}
              onClick={() => onSelectTime(slot)}
            >
              {slot.time}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
