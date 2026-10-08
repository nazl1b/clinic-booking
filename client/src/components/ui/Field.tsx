// Form building blocks. Inputs and selects stay native elements; they get
// their look from the global styles, so every form looks the same.

import { cloneElement, useId, type ReactElement, type ReactNode } from 'react';
import { noteIdFor } from '../../utils/validation';

// What Field sets on its control.
interface ControlProps {
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string; // shown in red under the control, in place of the hint
  inline?: boolean; // label next to the control instead of above it
  children: ReactElement<ControlProps>; // the <input> / <select>
}

// The label points at the control (htmlFor) instead of wrapping it, so the
// hint and the error are not read out as part of the field's name; they are
// linked with aria-describedby instead.
export function Field({ label, hint, error, inline, children }: FieldProps) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  return (
    <div className={`field${inline ? ' field-inline' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': noteIdFor(id, hint, error) })}
      <FieldNote id={id} hint={hint} error={error} />
    </div>
  );
}

// The line under a control: its error if it has one, otherwise its hint.
export function FieldNote({ id, hint, error }: { id: string; hint?: ReactNode; error?: string }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="field-error">
        {error}
      </p>
    );
  }
  if (!hint) return null;
  return (
    <small id={`${id}-hint`} className="field-hint">
      {hint}
    </small>
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
