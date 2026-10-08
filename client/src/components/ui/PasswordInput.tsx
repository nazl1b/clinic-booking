// Password field with a show / hide button. Used for every password in the app.
//
// Same structure as Field (label, control, error or hint), but the control is
// the input plus its button, which Field cannot wrap.

import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { noteIdFor } from '../../utils/validation';
import { Icon } from '../layout/Icon';
import { FieldNote } from './Field';

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type' | 'id'> & {
  label: string;
  hint?: ReactNode;
  error?: string; // shown in red under the field, in place of the hint
};

export function PasswordInput({ label, hint, error, ...inputProps }: PasswordInputProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="password-input">
        <input
          {...inputProps}
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={noteIdFor(id, hint, error)}
        />
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
      <FieldNote id={id} hint={hint} error={error} />
    </div>
  );
}
