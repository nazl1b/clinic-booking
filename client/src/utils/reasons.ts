import type { VisitReason } from '../types';

// Reasons for a visit, in the order the forms offer them. The values are the
// VisitReason enum of server/prisma/schema.prisma; the server checks them.
export const VISIT_REASON_LABELS: Record<VisitReason, string> = {
  first_visit: 'First visit',
  follow_up: 'Follow-up',
  check_up: 'Check-up',
  test_results: 'Test results',
  other: 'Other',
};

export const VISIT_REASONS = Object.keys(VISIT_REASON_LABELS) as VisitReason[];

export const REASON_REQUIRED = 'Please choose a reason for the visit.';
