// Fake outbox. Plays the role of Ethereal during frontend development:
// emails are not sent anywhere, they are collected here so the dev panel can
// show them (with their invitation / reset links).

export interface MockEmail {
  id: number;
  to: string;
  subject: string;
  body: string;
  link?: string; // in-app path, e.g. /accept-invite?token=...
  sentAt: string;
}

// Replaced (never mutated) on every send so useSyncExternalStore sees a new snapshot.
let outbox: MockEmail[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

export function sendMockEmail(email: Omit<MockEmail, 'id' | 'sentAt'>): void {
  outbox = [{ ...email, id: nextId++, sentAt: new Date().toISOString() }, ...outbox];
  console.info(`[mock email] to ${email.to}: ${email.subject}`, email.link ?? '');
  listeners.forEach((listener) => listener());
}

export function getMockEmails(): MockEmail[] {
  return outbox;
}

export function subscribeToMockEmails(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
