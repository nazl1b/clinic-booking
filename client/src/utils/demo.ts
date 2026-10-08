// Demo accounts created by the seed script (server/prisma/seed.ts, listed in
// the README). The login page offers them so visitors can try the app; on the
// public demo the server keeps their password (PROTECT_DEMO_ACCOUNTS, see
// server/src/utils/emails.ts). No admin here on purpose.

import type { Role } from '../types';

export interface DemoAccount {
  role: Role;
  email: string;
  password: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: 'patient', email: 'john@example.com', password: 'password123' },
  { role: 'doctor', email: 'maria@clinic.test', password: 'password123' },
];
