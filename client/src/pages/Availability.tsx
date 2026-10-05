// Weekly working hours of the logged-in doctor. Several windows per day are
// allowed (e.g. 09:00–13:00 and 17:00–20:00).

import { useEffect, useState, type FormEvent } from 'react';
import { getErrorMessage } from '../api/client';
import { getMyAvailability, saveMyAvailability } from '../api/doctor';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormActions } from '../components/ui/Field';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import { ActionsCell, Table } from '../components/ui/Table';
import type { AvailabilityRule } from '../types';
import { DAY_NAMES } from '../utils/dates';

// Monday first, as in a Greek calendar.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60];

function sortRules(rules: AvailabilityRule[]): AvailabilityRule[] {
  return [...rules].sort(
    (a, b) => WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek) || a.startTime.localeCompare(b.startTime),
  );
}

export default function Availability() {
  const [rules, setRules] = useState<AvailabilityRule[] | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyAvailability()
      .then((result) => setRules(sortRules(result)))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  function updateRule(index: number, changes: Partial<AvailabilityRule>) {
    setRules((current) => current && current.map((rule, i) => (i === index ? { ...rule, ...changes } : rule)));
    setSuccess('');
  }

  function addRule() {
    setRules((current) => [...(current ?? []), { dayOfWeek: 1, startTime: '09:00', endTime: '14:00', slotMinutes: 30 }]);
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
        <Card
          title="Weekly schedule"
          onSubmit={handleSave}
          actions={
            <Button variant="secondary" size="sm" onClick={addRule}>
              + Add hours
            </Button>
          }
        >
          {rules.length === 0 ? (
            <Muted>No working hours yet. Patients cannot book you until you add some.</Muted>
          ) : (
            <Table
              columns={[
                { label: 'Day' },
                { label: 'From' },
                { label: 'To' },
                { label: 'Appointment length' },
                { label: 'Actions', align: 'right', hidden: true },
              ]}
            >
              {rules.map((rule, index) => (
                <tr key={index}>
                  <td>
                    <select value={rule.dayOfWeek} onChange={(e) => updateRule(index, { dayOfWeek: Number(e.target.value) })} aria-label="Day">
                      {WEEK_ORDER.map((day) => (
                        <option key={day} value={day}>
                          {DAY_NAMES[day]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input type="time" value={rule.startTime} step={300} required onChange={(e) => updateRule(index, { startTime: e.target.value })} aria-label="From" />
                  </td>
                  <td>
                    <input type="time" value={rule.endTime} step={300} required onChange={(e) => updateRule(index, { endTime: e.target.value })} aria-label="To" />
                  </td>
                  <td>
                    <select value={rule.slotMinutes} onChange={(e) => updateRule(index, { slotMinutes: Number(e.target.value) })} aria-label="Appointment length">
                      {SLOT_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m} min
                        </option>
                      ))}
                    </select>
                  </td>
                  <ActionsCell>
                    <Button variant="tertiary" size="sm" danger onClick={() => removeRule(index)}>
                      Remove
                    </Button>
                  </ActionsCell>
                </tr>
              ))}
            </Table>
          )}

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
