// Error messages under the fields of one form, checked on submit:
//
//   const { errors, validate } = useFieldErrors<'email' | 'password'>();
//   if (!validate(e.currentTarget, { email: checkEmail(email), password: ... })) return;
//   <Field label="Email" error={errors.email}>…
//
// The messages stay until the next submit (or clear(), e.g. when a form is filled in for the user).

import { useState } from 'react';
import { flushSync } from 'react-dom';
import { focusFirstInvalid } from '../utils/validation';

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function useFieldErrors<K extends string>() {
  const [errors, setErrors] = useState<FieldErrors<K>>({});

  // Shows the results (undefined = the field is fine) and focuses the first
  // invalid field. Returns true when every field is valid.
  function validate(form: HTMLFormElement, results: Record<K, string | undefined>): boolean {
    const found: FieldErrors<K> = {};
    for (const key in results) if (results[key]) found[key] = results[key];
    // Render the messages now, so the invalid fields carry aria-invalid when focused.
    flushSync(() => setErrors(found));
    const valid = Object.keys(found).length === 0;
    if (!valid) focusFirstInvalid(form);
    return valid;
  }

  const clear = () => setErrors({});

  return { errors, validate, clear };
}
