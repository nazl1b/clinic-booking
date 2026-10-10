// Select of the reason for a visit, for the patient's booking and the phone
// appointment form. Put it in a Field: the Field's id and error reach the <select>.

import type { SelectHTMLAttributes } from 'react';
import type { VisitReason } from '../types';
import { VISIT_REASON_LABELS, VISIT_REASONS } from '../utils/reasons';

interface ReasonSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  value: VisitReason | ''; // '' = not chosen yet
  onChange: (reason: VisitReason) => void;
}

export function ReasonSelect({ value, onChange, ...rest }: ReasonSelectProps) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as VisitReason)} required {...rest}>
      <option value="" disabled>
        Choose a reason
      </option>
      {VISIT_REASONS.map((reason) => (
        <option key={reason} value={reason}>
          {VISIT_REASON_LABELS[reason]}
        </option>
      ))}
    </select>
  );
}
