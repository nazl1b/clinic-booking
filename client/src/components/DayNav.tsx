// Previous / today / next day buttons and a date input for the day schedule.

import { addDays, clinicToday, formatDate } from '../utils/dates';
import { Icon } from './layout/Icon';
import { Button } from './ui/Button';

interface DayNavProps {
  date: string;
  onChange: (date: string) => void;
}

export function DayNav({ date, onChange }: DayNavProps) {
  return (
    <>
      <div className="button-group">
        <Button variant="secondary" size="sm" onClick={() => onChange(addDays(date, -1))} aria-label="Previous day">
          <Icon name="chevronLeft" size={16} />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onChange(clinicToday())}>
          Today
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onChange(addDays(date, 1))} aria-label="Next day">
          <Icon name="chevronRight" size={16} />
        </Button>
      </div>
      <input type="date" value={date} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Go to date" />
      <strong className="toolbar-label">{formatDate(date)}</strong>
    </>
  );
}
