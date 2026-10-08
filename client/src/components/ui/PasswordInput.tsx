// Password field with a show / hide button. Used for every password in the app.
//
// It renders its own label (same look as Field) instead of going inside <Field>:
// Field wraps the control in a <label>, and a button inside that label would be
// read out as part of the field's name ("Password Show password").

import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { Icon } from '../layout/Icon';

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type' | 'id'> & {
  label: string;
  hint?: ReactNode;
};

export function PasswordInput({ label, hint, ...inputProps }: PasswordInputProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="password-input">
        <input {...inputProps} id={id} type={visible ? 'text' : 'password'} aria-describedby={hint ? hintId : undefined} />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-controls={id}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </div>
      {hint && (
        <small id={hintId} className="field-hint">
          {hint}
        </small>
      )}
    </div>
  );
}
