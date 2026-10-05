// Day / week switcher with previous / today / next buttons.

import { addDays, clinicToday, formatDate, rangeFor, type RangeMode } from '../utils/dates';
import { Button } from './ui/Button';
import { Segmented } from './ui/Segmented';

interface DateRangeNavProps {
  mode: RangeMode;
  anchor: string;
  onChange: (mode: RangeMode, anchor: string) => void;
}

export function DateRangeNav({ mode, anchor, onChange }: DateRangeNavProps) {
  const { from, to } = rangeFor(mode, anchor);
  const step = mode === 'day' ? 1 : 7;

  return (
    <div className="toolbar">
      <Segmented
        label="View"
        options={[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
        ]}
        value={mode}
        onChange={(m) => onChange(m, anchor)}
      />
      <div className="button-group">
        <Button variant="secondary" size="sm" onClick={() => onChange(mode, addDays(anchor, -step))} aria-label="Previous">
          ‹
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onChange(mode, clinicToday())}>
          Today
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onChange(mode, addDays(anchor, step))} aria-label="Next">
          ›
        </Button>
      </div>
      <input type="date" value={anchor} onChange={(e) => e.target.value && onChange(mode, e.target.value)} aria-label="Go to date" />
      <strong className="toolbar-label">{mode === 'day' ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`}</strong>
    </div>
  );
}
