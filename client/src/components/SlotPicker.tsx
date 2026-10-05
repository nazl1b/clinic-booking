// Week strip + grid of free time slots for one doctor. The strip shows the
// seven days of the chosen date's week and how many times are free on each
// day, so the user sees at a glance where there is room. Picking a day shows
// its slots straight away; the week's slots reload only when the week (or
// doctor) changes.

import { useEffect, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { getDoctorSlots, type FreeSlot } from '../api/doctors';
import { addDays, clinicToday, formatDate, formatWeekday, startOfWeek } from '../utils/dates';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
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
  const today = clinicToday();
  const weekStart = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // The result remembers which request it belongs to; while it does not match
  // the current one, the week is still loading.
  const requestKey = `${doctorId}|${weekStart}|${reloadKey}`;
  const [result, setResult] = useState<{ key: string; slotsByDate: Record<string, FreeSlot[]>; error: string } | null>(null);
  const loading = result?.key !== requestKey;
  const slotsByDate = loading ? {} : result.slotsByDate;
  const error = loading ? '' : result.error;
  const slots = slotsByDate[date] ?? [];

  useEffect(() => {
    let ignore = false;
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    // Past days can have no free times, so they are not requested.
    Promise.all(weekDays.map((d) => (d < clinicToday() ? Promise.resolve([]) : getDoctorSlots(doctorId, d))))
      .then((lists) => !ignore && setResult({ key: requestKey, slotsByDate: Object.fromEntries(weekDays.map((d, i) => [d, lists[i]])), error: '' }))
      .catch((err) => !ignore && setResult({ key: requestKey, slotsByDate: {}, error: getErrorMessage(err) }));
    return () => {
      ignore = true;
    };
  }, [doctorId, weekStart, requestKey]);

  function pickDay(day: string) {
    if (day === date) return;
    onDateChange(day);
    onSelectTime(null);
  }

  // Moving to another week selects its first day that is not in the past.
  function moveWeek(weeks: number) {
    const start = addDays(weekStart, weeks * 7);
    pickDay(start < today ? today : start);
  }

  return (
    <div className="stack-sm">
      <div className="week-picker-head">
        <Button variant="secondary" size="sm" onClick={() => moveWeek(-1)} disabled={weekStart <= today} aria-label="Previous week">
          ‹
        </Button>
        <Button variant="secondary" size="sm" onClick={() => moveWeek(1)} aria-label="Next week">
          ›
        </Button>
        <strong className="week-picker-label">
          {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}
        </strong>
      </div>

      <div className="day-strip" role="group" aria-label="Day">
        {days.map((day) => {
          const past = day < today;
          const count = slotsByDate[day]?.length ?? 0;
          const status = past ? '—' : loading ? '…' : count > 0 ? `${count} free` : 'No times';
          const classes = ['day-btn', day === date && 'selected', !past && !loading && count === 0 && 'day-btn-empty'].filter(Boolean).join(' ');
          return (
            <button
              key={day}
              type="button"
              className={classes}
              disabled={past}
              aria-pressed={day === date}
              aria-label={`${formatDate(day)}, ${status === '—' ? 'past' : status}`}
              onClick={() => pickDay(day)}
            >
              <span className="day-btn-weekday">{day === today ? 'Today' : formatWeekday(day)}</span>
              <span className="day-btn-number">{Number(day.slice(8, 10))}</span>
              <span className="day-btn-free">{status}</span>
            </button>
          );
        })}
      </div>

      <Alert type="error">{error}</Alert>
      {loading ? (
        <Muted>Loading free times…</Muted>
      ) : slots.length === 0 ? (
        !error && <Muted>No free times on {formatDate(date)}. Try another day.</Muted>
      ) : (
        <div className="slot-grid" role="listbox" aria-label={`Free times on ${formatDate(date)}`}>
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
