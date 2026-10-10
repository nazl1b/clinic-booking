import type { Role } from '../types';

export const ROLE_LABELS: Record<Role, string> = { patient: 'Patient', doctor: 'Doctor', admin: 'Administrator' };

// Landing page for each role after login.
export function homePathFor(role: Role): string {
  switch (role) {
    case 'patient':
      return '/doctors';
    case 'doctor':
      return '/doctor/schedule';
    case 'admin':
      return '/admin/appointments';
  }
}
