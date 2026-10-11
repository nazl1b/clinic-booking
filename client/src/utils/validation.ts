// Checks run when a form is submitted. Forms set noValidate (see Card), so these
// replace the browser's own bubbles: the same checks it made (required, email,
// minimum length) plus "passwords match", with our messages under
// each field. The server checks everything again.
// Each check returns the message to show, or undefined when the value is fine.

import { MIN_PASSWORD_LENGTH, PASSWORD_MISMATCH } from './limits';

// Loose on purpose (something@something.tld): the server has the real rule.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function required(value: string, message: string): string | undefined {
  return value.trim() ? undefined : message;
}

export function checkEmail(value: string): string | undefined {
  if (!value.trim()) return 'Please enter an email address.';
  if (!EMAIL_PATTERN.test(value.trim())) return 'Please enter a valid email address, e.g. name@example.com.';
  return undefined;
}

// A password being chosen (register, reset, invitation, change).
export function checkNewPassword(value: string): string | undefined {
  if (!value) return 'Please enter a password.';
  if (value.length < MIN_PASSWORD_LENGTH) return `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  return undefined;
}

export function checkConfirmPassword(value: string, password: string): string | undefined {
  if (!value) return 'Please enter the password again.';
  if (value !== password) return PASSWORD_MISMATCH;
  return undefined;
}

// aria-describedby of a field: its error when it has one, otherwise its hint.
export function noteIdFor(id: string, hint: unknown, error: string | undefined): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

// After the messages are on screen: focus the first invalid field of the form.
export function focusFirstInvalid(form: HTMLFormElement): void {
  form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}
