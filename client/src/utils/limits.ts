// Limits the server also checks. The browser checks them first so the user sees
// the problem sooner; the server stays the one that decides. Keep in sync with:
//   server/src/schemas/auth.ts            MIN_PASSWORD_LENGTH
//   server/src/schemas/admin.ts           name, specialty
//   server/src/schemas/common.ts          BIO_MAX_LENGTH
//   server/src/schemas/appointments.ts    guest name, phone, note, MAX_PAGE_SIZE
//   server/src/services/emailTemplates.ts INVITATION_HOURS, PASSWORD_RESET_HOURS

export const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters.`;
export const PASSWORD_MISMATCH = 'Passwords do not match.';

export const NAME_MAX_LENGTH = 100;
export const SPECIALTY_MAX_LENGTH = 100;
export const PHONE_MAX_LENGTH = 30;
export const NOTE_MAX_LENGTH = 200;
export const BIO_MAX_LENGTH = 500;

// Largest page the appointment list endpoints return.
export const MAX_PAGE_SIZE = 100;

// How long the emailed links work.
export const INVITATION_HOURS = 48;
export const PASSWORD_RESET_HOURS = 1;
export const MISSING_TOKEN = 'This link is missing its token. Please use the link from the email.';
