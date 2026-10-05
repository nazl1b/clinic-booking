// Weekly working hours of the logged-in doctor. Several windows per day are
// allowed (e.g. 09:00–13:00 and 17:00–20:00).
// Each day is one collapsed line with a summary; clicking it opens the day
// (accordion) to edit its hours. All days are saved together.

import { useEffect, useState, type FormEvent } from 'react';
import { getErrorMessage } from '../api/client';
import { getMyAvailability, saveMyAvailability } from '../api/doctor';
import { Icon } from '../components/layout/Icon';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormActions } from '../components/ui/Field';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import type { AvailabilityRule } from '../types';
import { DAY_NAMES, fromMinutes, toMinutes } from '../utils/dates';

// Monday first, as in a Greek calendar.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60];

function sortRules(rules: AvailabilityRule[]): AvailabilityRule[] {
  return [...rules].sort(
    (a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek) || a.startTime.localeCompare(b.startTime),
  );
}

// "08:00–14:00, 15:00–20:00 · 30 min"
function daySummary(rules: AvailabilityRule[]): string {
  const sorted = [...rules].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const hours = sorted.map((r) => `${r.startTime || '--:--'}–${r.endTime || '--:--'}`).join(', ');
  const lengths = [...new Set(sorted.map((r) => r.slotMinutes))].sort((a, b) => a - b);
  return `${hours} · ${lengths.join(', ')} min`;
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
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

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
    setSuccess('');
  }

  function addRule(day: number) {
    setRules((current) => [...(current ?? []), newRule(day, (current ?? []).filter((r) => r.dayOfWeek === day))]);
    setSuccess('');
  }

  function removeRule(index: number) {
    setRules((current) => current && current.filter((_, i) => i !== index));
    setSuccess('');
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!rules) return;
    setError('');
    setSuccess('');
    // A collapsed day's inputs are not in the form, so the browser cannot check them.
    const incomplete = rules.find((r) => !r.startTime || !r.endTime);
    if (incomplete) {
      setOpenDays((current) => new Set(current).add(incomplete.dayOfWeek));
      setError(`Please fill in both times for ${DAY_NAMES[incomplete.dayOfWeek]}.`);
      return;
    }
    setSaving(true);
    try {
      await saveMyAvailability(rules);
      setRules(sortRules(rules));
      setSuccess('Working hours saved. Existing appointments are kept.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Working hours" description="Patients can book only inside these hours. Times are in Greek time (Europe/Athens)." />

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
                      {working ? (
                        entries.map(({ rule, index }) => (
                          <div key={index} className="hours-row">
                            <input
                              type="time"
                              value={rule.startTime}
                              step={300}
                              required
                              onChange={(e) => updateRule(index, { startTime: e.target.value })}
                              aria-label={`${DAY_NAMES[day]} from`}
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
                            />
                            <select
                              value={rule.slotMinutes}
                              onChange={(e) => updateRule(index, { slotMinutes: Number(e.target.value) })}
                              aria-label={`${DAY_NAMES[day]} appointment length`}
                            >
                              {SLOT_OPTIONS.map((m) => (
                                <option key={m} value={m}>
                                  {m} min appointments
                                </option>
                              ))}
                            </select>
                            <Button variant="tertiary" size="sm" danger onClick={() => removeRule(index)}>
                              Remove
                            </Button>
                          </div>
                        ))
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
          <Alert type="success">{success}</Alert>
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
