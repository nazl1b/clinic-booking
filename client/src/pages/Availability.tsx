// Weekly working hours of the logged-in doctor. Several windows per day are
// allowed (e.g. 09:00–13:00 and 17:00–20:00), all with the same appointment
// length (the server refuses different lengths on one day).
// Each day is one collapsed line with a summary; clicking it opens the day
// (accordion) to edit its hours. All days are saved together.

import { Fragment, useEffect, useState, type FormEvent } from 'react';
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
import type { AvailabilityRule } from '../types';
import { CLINIC_TIMEZONE, DAY_NAMES, fromMinutes, toMinutes } from '../utils/dates';
import { checkTime, focusFirstInvalid } from '../utils/validation';

// Monday first, as in a Greek calendar.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60];

// Problem with one row of hours: the message and which of its two times is wrong.
interface RowError {
  message: string;
  start: boolean;
  end: boolean;
}

function sortRules(rules: AvailabilityRule[]): AvailabilityRule[] {
  return [...rules].sort(
    (a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek) || a.startTime.localeCompare(b.startTime),
  );
}

// "08:00–14:00, 15:00–20:00 · 30 min"
function daySummary(rules: AvailabilityRule[]): string {
  const sorted = [...rules].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const hours = sorted.map((r) => `${r.startTime || '--:--'}–${r.endTime || '--:--'}`).join(', ');
  return `${hours} · ${sorted[0].slotMinutes} min`;
}

// New hours for a day: after the day's last window if it has one, else a morning.
function newRule(day: number, existing: AvailabilityRule[]): AvailabilityRule {
  const fallback = { dayOfWeek: day, startTime: '09:00', endTime: '14:00', slotMinutes: existing.at(-1)?.slotMinutes ?? 30 };
  const lastEnd = Math.max(0, ...existing.map((r) => (r.endTime ? toMinutes(r.endTime) : 0)));
  if (lastEnd === 0) return fallback;
  const start = lastEnd + 60;
  const end = Math.min(start + 5 * 60, 23 * 60 + 55);
  return start < end ? { ...fallback, startTime: fromMinutes(start), endTime: fromMinutes(end) } : fallback;
}

export default function Availability() {
  const [rules, setRules] = useState<AvailabilityRule[] | null>(null);
  const [openDays, setOpenDays] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<number, RowError>>({}); // by index in `rules`, checked on save

  useEffect(() => {
    getMyAvailability()
      .then((result) => setRules(sortRules(result)))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

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
    setRules((current) => [...(current ?? []), newRule(day, (current ?? []).filter((r) => r.dayOfWeek === day))]);
  }

  function removeRule(index: number) {
    setRules((current) => current && current.filter((_, i) => i !== index));
    setRowErrors({}); // the indexes move
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rules) return;
    setError('');
    const found: Record<number, RowError> = {};
    rules.forEach((rule, index) => {
      const start = checkTime(rule.startTime);
      const end = checkTime(rule.endTime);
      if (start || end) found[index] = { message: (start ?? end)!, start: Boolean(start), end: Boolean(end) };
    });
    const daysWithErrors = Object.keys(found).map((index) => rules[Number(index)].dayOfWeek);
    // Open the days with a problem (a collapsed day has no inputs to focus), then focus the first one.
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
              // Keep each rule's index in `rules`, so edits go to the right one.
              const entries = rules.map((rule, index) => ({ rule, index })).filter((e) => e.rule.dayOfWeek === day);
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
                                <input
                                  type="time"
                                  value={rule.startTime}
                                  step={300}
                                  required
                                  onChange={(e) => updateRule(index, { startTime: e.target.value })}
                                  aria-label={`${DAY_NAMES[day]} from`}
                                  aria-invalid={rowError?.start || undefined}
                                  aria-describedby={rowError ? errorId : undefined}
                                />
                                <span className="hours-sep" aria-hidden="true">
                                  –
                                </span>
                                <input
                                  type="time"
                                  value={rule.endTime}
                                  step={300}
                                  required
                                  onChange={(e) => updateRule(index, { endTime: e.target.value })}
                                  aria-label={`${DAY_NAMES[day]} to`}
                                  aria-invalid={rowError?.end || undefined}
                                  aria-describedby={rowError ? errorId : undefined}
                                />
                                <Button variant="tertiary" size="sm" danger onClick={() => removeRule(index)}>
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
                      <div>
                        <Button variant="tertiary" size="sm" onClick={() => addRule(day)}>
                          + Add hours
                        </Button>
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
