// Development-only panel: switch role with one click and read the emails the
// mock API "sent" (invitation and password reset links). Not rendered in
// production builds (see Layout).

import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { DEMO_PASSWORD } from '../api/mock/db';
import { getMockEmails, subscribeToMockEmails } from '../api/mock/emails';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';
import { formatTimestamp } from '../utils/dates';

const ROLES: Role[] = ['patient', 'doctor', 'admin'];

export function DevPanel() {
  const { user, devLoginAs } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const emails = useSyncExternalStore(subscribeToMockEmails, getMockEmails);

  async function switchTo(role: Role | null) {
    setBusy(true);
    try {
      await devLoginAs(role);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="dev-panel" aria-label="Development tools">
      <div className="dev-panel-bar">
        <span className="dev-label">DEV</span>
        <span className="dev-role-label">Role:</span>
        {ROLES.map((role) => (
          <button
            key={role}
            type="button"
            className={`dev-role ${user?.role === role ? 'active' : ''}`}
            disabled={busy}
            onClick={() => switchTo(role)}
          >
            {role}
          </button>
        ))}
        <button type="button" className={`dev-role ${user ? '' : 'active'}`} disabled={busy} onClick={() => switchTo(null)}>
          guest
        </button>
        <button type="button" className="dev-toggle" onClick={() => setOpen(!open)}>
          Mock inbox ({emails.length}) {open ? '▾' : '▸'}
        </button>
      </div>

      {open && (
        <div className="dev-inbox">
          <p className="muted small">
            Seeded accounts use the password <code>{DEMO_PASSWORD}</code>. Data resets on page reload.
          </p>
          {emails.length === 0 && <p className="muted small">No emails sent yet.</p>}
          {emails.map((email) => (
            <div key={email.id} className="dev-email">
              <div>
                <strong>{email.subject}</strong> → {email.to}
                <span className="muted small"> · {formatTimestamp(email.sentAt)}</span>
              </div>
              <div className="small">{email.body}</div>
              {email.link && (
                <Link to={email.link} className="small" onClick={() => setOpen(false)}>
                  Open link
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
