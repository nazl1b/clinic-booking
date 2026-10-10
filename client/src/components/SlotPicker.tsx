// Day strip + free time slots for one doctor. The strip shows seven days,
// starting today (clinic time) and moving 7 days at a time, with how many times
// are free on each day, so the user sees at a glance where there is room.
// Picking a day shows its slots straight away, grouped into morning, afternoon
// and evening; the slots reload only when the seven days (or doctor) change.

import { useEffect, useId, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { getDoctorSlots, type FreeSlot } from '../api/doctors';
import { addDays, clinicToday, daysBetween, formatDate, formatWeekday, groupByDayPart } from '../utils/dates';
import { Icon } from './layout/Icon';
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
  const groupId = useId();
  const today = clinicToday();
  // The seven days shown: today + 0, 7, 14… days, whichever block holds `date`.
  const weekStart = addDays(today, Math.floor(Math.max(0, daysBetween(today, date)) / 7) * 7);
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
    Promise.all(weekDays.map((d) => getDoctorSlots(doctorId, d)))
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

  // Moving 7 days selects the first of the new seven (never before today).
  function moveWeek(weeks: number) {
    const start = addDays(weekStart, weeks * 7);
    pickDay(start < today ? today : start);
  }

  const groups = groupByDayPart(slots);

  return (
    <div className="stack-sm">
      <div className="week-picker-head">
        <Button variant="secondary" size="sm" onClick={() => moveWeek(-1)} disabled={weekStart <= today} aria-label="Previous 7 days">
          <Icon name="chevronLeft" size={16} />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => moveWeek(1)} aria-label="Next 7 days">
          <Icon name="chevronRight" size={16} />
        </Button>
        <strong className="week-picker-label">
          {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}
        </strong>
      </div>

      <div className="day-strip" role="group" aria-label="Day">
        {days.map((day) => {
          const count = slotsByDate[day]?.length ?? 0;
          const status = loading ? '…' : count > 0 ? `${count} free` : 'No times';
          const classes = ['day-btn', day === date && 'selected', !loading && count === 0 && 'day-btn-empty'].filter(Boolean).join(' ');
          return (
            <button
              key={day}
              type="button"
              className={classes}
              aria-pressed={day === date}
              aria-label={`${formatDate(day)}, ${loading ? 'loading' : status}`}
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
        <div className="slot-groups" role="group" aria-label={`Free times on ${formatDate(date)}`}>
          {groups.map((group) => (
            <section key={group.label} className="slot-group" aria-labelledby={`${groupId}-${group.label}`}>
              <h3 id={`${groupId}-${group.label}`} className="slot-group-title">
                {group.label}
              </h3>
              <div className="slot-grid">
                {group.items.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    aria-pressed={slot.time === selectedTime}
                    className={`slot${slot.time === selectedTime ? ' selected' : ''}`}
                    onClick={() => onSelectTime(slot)}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
