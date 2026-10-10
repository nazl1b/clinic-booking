// Seven day buttons with arrows that move 7 days at a time. Each day shows a short
// status (e.g. "3 free"); days marked empty are faded, so the days with something
// on them stand out. Used by the slot picker (booking) and the doctor's schedule.

import type { ReactNode } from 'react';
import { addDays, clinicToday, formatDate, formatWeekday } from '../utils/dates';
import { Icon } from './layout/Icon';
import { Button } from './ui/Button';

export interface DayStatus {
  label: string; // shown under the day number, short enough for a phone, e.g. "3 free"
  description?: string; // read by screen readers instead of `label`, e.g. "3 active appointments"
  empty: boolean; // nothing on this day: faded
}

interface DayStripProps {
  weekStart: string; // first of the seven days
  selected: string;
  onSelect: (day: string) => void;
  onMoveWeek: (weeks: number) => void; // -1 / +1
  canGoBack?: boolean; // default true
  loading: boolean; // the statuses are not known yet
  statusOf: (day: string) => DayStatus; // only called once loaded
  actions?: ReactNode; // on the right of the arrows, e.g. a date input
}

export function DayStrip({ weekStart, selected, onSelect, onMoveWeek, canGoBack = true, loading, statusOf, actions }: DayStripProps) {
  const today = clinicToday();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <>
      <div className="week-picker-head">
        <Button variant="secondary" size="sm" onClick={() => onMoveWeek(-1)} disabled={!canGoBack} aria-label="Previous 7 days">
          <Icon name="chevronLeft" size={16} />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onMoveWeek(1)} aria-label="Next 7 days">
          <Icon name="chevronRight" size={16} />
        </Button>
        <strong className="week-picker-label">
          {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}
        </strong>
        {actions && <div className="week-picker-actions">{actions}</div>}
      </div>

      <div className="day-strip" role="group" aria-label="Day">
        {days.map((day) => {
          const status = loading ? null : statusOf(day);
          const classes = ['day-btn', day === selected && 'selected', status?.empty && 'day-btn-empty'].filter(Boolean).join(' ');
          return (
            <button
              key={day}
              type="button"
              className={classes}
              aria-pressed={day === selected}
              aria-label={`${formatDate(day)}, ${status ? (status.description ?? status.label) : 'loading'}`}
              onClick={() => onSelect(day)}
            >
              <span className="day-btn-weekday">{day === today ? 'Today' : formatWeekday(day)}</span>
              <span className="day-btn-number">{Number(day.slice(8, 10))}</span>
              <span className="day-btn-free">{status ? status.label : '…'}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
