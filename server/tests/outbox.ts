import type { Email } from '../src/services/email.js'

// Emails "sent" during the tests (setup.ts replaces sendEmail). Nothing leaves the machine.
export const outbox: Email[] = []
