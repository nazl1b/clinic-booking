// Day strip + free time slots for one doctor. The strip shows seven days,
// starting today (clinic time) and moving 7 days at a time, with how many times
// are free on each day, so the user sees at a glance where there is room.
// Picking a day shows its slots straight away, grouped into morning, afternoon
// and evening; the slots reload only when the seven days (or doctor) change.
// When a new seven days load, the first day with free times is selected.

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { getDoctorSlots, type FreeSlot } from '../api/doctors';
import { addDays, clinicToday, formatDate, groupByDayPart, weekStartFor } from '../utils/dates';
import { DayStrip } from './DayStrip';
import { Alert } from './ui/Alert';
import { Muted } from './ui/PageHeader';

interface SlotPickerProps {
  doctorId: number;
  date: string;
  onDateChange: (date: string) => void;
  selectedTime: string | null;
  onSelectTime: (slot: FreeSlot | null, daySlots: FreeSlot[]) => void; // daySlots: every free time of that day, by time
  reloadKey?: number; // bump to force a reload, e.g. after a 409
}

export function SlotPicker({ doctorId, date, onDateChange, selectedTime, onSelectTime, reloadKey = 0 }: SlotPickerProps) {
  const groupId = useId();
  const today = clinicToday();
  // The seven days shown: today + 0, 7, 14… days, whichever block holds `date`.
  const weekStart = weekStartFor(date < today ? today : date, today);

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

  // Once per doctor and seven days (opening the page, changing week or doctor):
  // select the first day with free times. Not after a reload (reloadKey), and not
  // when a time is already chosen. If no day has
  // times, the first day stays selected. A layout effect, so the empty first day
  // never flashes on screen.
  const weekKey = `${doctorId}|${weekStart}`;
  const autoPickedWeek = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (result?.key !== requestKey || result.error || autoPickedWeek.current === weekKey) return;
    autoPickedWeek.current = weekKey;
    if (selectedTime) return;
    const firstFree = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).find((d) => (result.slotsByDate[d]?.length ?? 0) > 0);
    if (firstFree && firstFree !== date) onDateChange(firstFree);
  }, [result, requestKey, weekKey, weekStart, selectedTime, date, onDateChange]);

  function pickDay(day: string) {
    if (day === date) return;
    onDateChange(day);
    onSelectTime(null, []);
  }

  // Moving 7 days selects the first of the new seven (never before today).
  function moveWeek(weeks: number) {
    const start = addDays(weekStart, weeks * 7);
    pickDay(start < today ? today : start);
  }

  const groups = groupByDayPart(slots);

  return (
    <div className="stack-sm">
      <DayStrip
        weekStart={weekStart}
        selected={date}
        onSelect={pickDay}
        onMoveWeek={moveWeek}
        canGoBack={weekStart > today}
        loading={loading}
        statusOf={(day) => {
          const count = slotsByDate[day]?.length ?? 0;
          return { label: count > 0 ? `${count} free` : 'No times', empty: count === 0 };
        }}
      />

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
                    onClick={() => onSelectTime(slot, slots)}
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
