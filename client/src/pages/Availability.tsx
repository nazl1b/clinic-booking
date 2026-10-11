// Weekly working hours of the logged-in doctor. Several windows per day are
// allowed (e.g. 09:00–13:00 and 17:00–20:00), all with the same appointment
// length (the server refuses different lengths on one day).
// Each day is one collapsed line with a summary; clicking it opens the day
// (accordion) to edit its hours. All days are saved together; leaving the page
// with unsaved changes asks first.

import { Fragment, useEffect, useState, type ComponentProps, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { getErrorMessage } from '../api/client';
import { getMyAvailability, saveMyAvailability } from '../api/doctor';
import { Icon } from '../components/layout/Icon';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormActions } from '../components/ui/Field';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../hooks/useToast';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import type { AvailabilityRule } from '../types';
import { CLINIC_TIMEZONE, DAY_NAMES, fromMinutes, toMinutes } from '../utils/dates';
import { focusFirstInvalid } from '../utils/validation';
import { FIRST_TIME, LAST_TIME, SLOT_OPTIONS, timeOptions, timeStepFor } from '../utils/workingHours';

// Monday first, as in a Greek calendar.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAYS = [1, 2, 3, 4, 5]; // Monday–Friday, for "Copy to all weekdays"

// Problem with one row of hours: the message and which of its two times is wrong.
interface RowError {
  message: string;
  start: boolean;
  end: boolean;
}

const byStart = (a: AvailabilityRule, b: AvailabilityRule) => a.startTime.localeCompare(b.startTime);

function sortRules(rules: AvailabilityRule[]): AvailabilityRule[] {
  return [...rules].sort((a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek) || byStart(a, b));
}

// Same hours in any order count as no change.
const scheduleKey = (rules: AvailabilityRule[]) => JSON.stringify(sortRules(rules));

// "08:00–14:00, 15:00–20:00 · 30 min"
function daySummary(rules: AvailabilityRule[]): string {
  const sorted = [...rules].sort(byStart);
  const hours = sorted.map((r) => `${r.startTime}–${r.endTime}`).join(', ');
  return `${hours} · ${sorted[0].slotMinutes} min`;
}

// New hours for a day. A closed day gets a morning. Otherwise the latest free time
// of the day that holds at least one appointment, usually after the last hours
// (with an hour's break), up to 5 hours long. Null when the day has no room left.
function newRule(day: number, existing: AvailabilityRule[]): AvailabilityRule | null {
  const slotMinutes = existing[0]?.slotMinutes ?? 30;
  if (existing.length === 0) return { dayOfWeek: day, startTime: '09:00', endTime: '14:00', slotMinutes };

  const first = toMinutes(FIRST_TIME);
  const last = toMinutes(LAST_TIME);
  const step = timeStepFor(slotMinutes);
  const onGrid = (minutes: number, round: (x: number) => number) => first + round((minutes - first) / step) * step;

  // Free stretches of the day between FIRST_TIME and LAST_TIME.
  const taken = existing.map((r) => [toMinutes(r.startTime), toMinutes(r.endTime)] as const).sort((a, b) => a[0] - b[0]);
  const gaps: [number, number][] = [];
  let cursor = first;
  for (const [start, end] of taken) {
    if (start > cursor) gaps.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < last) gaps.push([cursor, last]);

  for (const [gapStart, gapEnd] of gaps.reverse()) {
    let start = onGrid(gapStart, Math.ceil);
    const end = onGrid(gapEnd, Math.floor);
    if (end - start < slotMinutes) continue;
    if (gapStart > first && end - (start + 60) >= slotMinutes) start += 60; // a break after the hours before
    return { dayOfWeek: day, startTime: fromMinutes(start), endTime: fromMinutes(Math.min(start + 5 * 60, end)), slotMinutes };
  }
  return null;
}

// Problems found on save, by index in `rules`: the end before the start, hours
// shorter than one appointment, and hours that overlap (or repeat) earlier hours
// of the same day. The server checks the same.
function checkRules(rules: AvailabilityRule[]): Record<number, RowError> {
  const found: Record<number, RowError> = {};
  rules.forEach((rule, index) => {
    const start = toMinutes(rule.startTime);
    const end = toMinutes(rule.endTime);
    if (start >= end) found[index] = { message: 'The end must be after the start.', start: false, end: true };
    else if (end - start < rule.slotMinutes) found[index] = { message: `Working hours must be at least one appointment (${rule.slotMinutes} min) long.`, start: false, end: true };
  });
  for (const day of WEEK_ORDER) {
    const entries = rules.map((rule, index) => ({ rule, index })).filter((e) => e.rule.dayOfWeek === day).sort((a, b) => byStart(a.rule, b.rule));
    entries.forEach(({ rule, index }, i) => {
      if (found[index]) return;
      const earlier = entries.slice(0, i).find(({ rule: other }) => toMinutes(other.startTime) < toMinutes(rule.endTime) && toMinutes(rule.startTime) < toMinutes(other.endTime));
      if (!earlier) return;
      const same = earlier.rule.startTime === rule.startTime && earlier.rule.endTime === rule.endTime;
      const message = same ? 'These hours are already on this day.' : `These hours overlap ${earlier.rule.startTime}–${earlier.rule.endTime}.`;
      found[index] = { message, start: true, end: true };
    });
  }
  return found;
}

// A start or end time: only the offered times (24-hour clock). A saved time that is
// not one of them (e.g. after changing the appointment length) is still shown.
function TimeSelect({ value, slotMinutes, onChange, ...rest }: Omit<ComponentProps<'select'>, 'value' | 'onChange'> & { value: string; slotMinutes: number; onChange: (time: string) => void }) {
  const options = timeOptions(slotMinutes);
  if (!options.includes(value)) options.push(value);
  options.sort();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {options.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </select>
  );
}

export default function Availability() {
  const [rules, setRules] = useState<AvailabilityRule[] | null>(null);
  const [savedKey, setSavedKey] = useState(''); // the schedule as last loaded or saved
  const [openDays, setOpenDays] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<number, RowError>>({}); // by index in `rules`, checked on save

  useEffect(() => {
    getMyAvailability()
      .then((result) => {
        setRules(sortRules(result));
        setSavedKey(scheduleKey(result));
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  // Unsaved changes: leaving the page asks first.
  useUnsavedChanges(rules !== null && scheduleKey(rules) !== savedKey);

  function toggleDay(day: number) {
    setOpenDays((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function updateRule(index: number, changes: Partial<AvailabilityRule>) {
    setRules((current) => current && current.map((rule, i) => (i === index ? { ...rule, ...changes } : rule)));
  }

  // One appointment length per day: changing it changes every window of the day.
  function setDaySlotMinutes(day: number, slotMinutes: number) {
    setRules((current) => current && current.map((rule) => (rule.dayOfWeek === day ? { ...rule, slotMinutes } : rule)));
  }

  function addRule(day: number) {
    const rule = newRule(day, (rules ?? []).filter((r) => r.dayOfWeek === day));
    if (!rule) {
      toast.error(`There is no free time left on ${DAY_NAMES[day]} between ${FIRST_TIME} and ${LAST_TIME}.`);
      return;
    }
    setRules((current) => [...(current ?? []), rule]);
  }

  function removeRule(index: number) {
    setRules((current) => current && current.filter((_, i) => i !== index));
    setRowErrors({}); // the indexes move
  }

  // This day's hours and appointment length replace those of the other weekdays (Mon–Fri).
  function copyToWeekdays(day: number) {
    setRules((current) => {
      if (!current) return current;
      const source = current.filter((r) => r.dayOfWeek === day);
      const targets = WEEKDAYS.filter((d) => d !== day);
      return sortRules([...current.filter((r) => !targets.includes(r.dayOfWeek)), ...targets.flatMap((d) => source.map((r) => ({ ...r, dayOfWeek: d })))]);
    });
    setRowErrors({}); // the indexes move
    toast.success(`${DAY_NAMES[day]}'s hours were copied to all weekdays (Monday–Friday). Save to keep them.`);
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rules) return;
    setError('');
    const found = checkRules(rules);
    const daysWithErrors = Object.keys(found).map((index) => rules[Number(index)].dayOfWeek);
    // Open the days with a problem (a collapsed day has no fields to focus), then focus the first one.
    flushSync(() => {
      setRowErrors(found);
      if (daysWithErrors.length > 0) setOpenDays((current) => new Set([...current, ...daysWithErrors]));
    });
    if (daysWithErrors.length > 0) {
      focusFirstInvalid(e.currentTarget);
      return;
    }
    setSaving(true);
    try {
      await saveMyAvailability(rules);
      setRules(sortRules(rules));
      setSavedKey(scheduleKey(rules));
      toast.success('Working hours saved. Existing appointments are kept.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Working hours" description={`Patients can book only inside these hours. Times are in Greek time (${CLINIC_TIMEZONE}).`} />

      {!rules ? (
        error ? <Alert type="error">{error}</Alert> : <Muted>Loading…</Muted>
      ) : (
        <Card title="Weekly schedule" description="Click a day to change its hours." onSubmit={handleSave}>
          <div className="day-list">
            {WEEK_ORDER.map((day) => {
              // Keep each rule's index in `rules`, so edits go to the right one; shown by start time.
              const entries = rules
                .map((rule, index) => ({ rule, index }))
                .filter((e) => e.rule.dayOfWeek === day)
                .sort((a, b) => byStart(a.rule, b.rule));
              const isOpen = openDays.has(day);
              const working = entries.length > 0;
              const bodyId = `day-${day}-hours`;
              return (
                <div key={day} className={`day-row${isOpen ? ' open' : ''}`}>
                  <button type="button" className="day-row-head" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => toggleDay(day)}>
                    <span className="day-row-name">{DAY_NAMES[day]}</span>
                    <span className="day-row-status">
                      <Badge tone={working ? 'primary' : 'neutral'}>{working ? 'Open' : 'Closed'}</Badge>
                    </span>
                    <span className="day-row-summary tabular">{working && daySummary(entries.map((e) => e.rule))}</span>
                    <span className="day-row-chevron">
                      <Icon name="chevronDown" size={18} />
                    </span>
                  </button>

                  {isOpen && (
                    <div id={bodyId} className="day-row-body">
                      {working && (
                        <label className="hours-row">
                          <span className="field-label">Appointment length</span>
                          <select value={entries[0].rule.slotMinutes} onChange={(e) => setDaySlotMinutes(day, Number(e.target.value))}>
                            {SLOT_OPTIONS.map((m) => (
                              <option key={m} value={m}>
                                {m} min
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {working ? (
                        entries.map(({ rule, index }) => {
                          const rowError = rowErrors[index];
                          const errorId = `${bodyId}-${index}-error`;
                          return (
                            <Fragment key={index}>
                              <div className="hours-row">
                                <TimeSelect
                                  value={rule.startTime}
                                  slotMinutes={rule.slotMinutes}
                                  onChange={(startTime) => updateRule(index, { startTime })}
                                  aria-label={`${DAY_NAMES[day]} from`}
                                  aria-invalid={rowError?.start || undefined}
                                  aria-describedby={rowError ? errorId : undefined}
                                />
                                <span className="hours-sep" aria-hidden="true">
                                  –
                                </span>
                                <TimeSelect
                                  value={rule.endTime}
                                  slotMinutes={rule.slotMinutes}
                                  onChange={(endTime) => updateRule(index, { endTime })}
                                  aria-label={`${DAY_NAMES[day]} to`}
                                  aria-invalid={rowError?.end || undefined}
                                  aria-describedby={rowError ? errorId : undefined}
                                />
                                <Button variant="secondary" size="sm" danger onClick={() => removeRule(index)}>
                                  Remove
                                </Button>
                              </div>
                              {rowError && (
                                <p id={errorId} className="field-error">
                                  {rowError.message}
                                </p>
                              )}
                            </Fragment>
                          );
                        })
                      ) : (
                        <Muted>Closed. Add hours to let patients book on {DAY_NAMES[day]}s.</Muted>
                      )}
                      <div className="button-group">
                        <Button variant="tertiary" size="sm" onClick={() => addRule(day)}>
                          + Add hours
                        </Button>
                        {working && (
                          <Button variant="tertiary" size="sm" onClick={() => copyToWeekdays(day)}>
                            Copy to all weekdays
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Alert type="error">{error}</Alert>
          <FormActions>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save working hours'}
            </Button>
          </FormActions>
        </Card>
      )}
    </div>
  );
}
