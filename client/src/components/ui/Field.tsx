// Form building blocks. Inputs and selects stay native elements; they get
// their look from the global styles, so every form looks the same.

import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  inline?: boolean; // label next to the control instead of above it
  children: ReactNode; // the <input> / <select>
}

export function Field({ label, hint, inline, children }: FieldProps) {
  return (
    <label className={`field${inline ? ' field-inline' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

// Puts fields side by side; they wrap on small screens.
export function FormRow({ children }: { children: ReactNode }) {
  return <div className="form-row">{children}</div>;
}

// Row of buttons at the end of a form or dialog.
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="form-actions">{children}</div>;
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
