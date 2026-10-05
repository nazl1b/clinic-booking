import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { acceptInvitation, getInvitation } from '../api/invitations';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { Muted } from '../components/ui/PageHeader';
import type { InvitationPreview } from '../types';

// Opened from the invitation email: /accept-invite?token=...
// The doctor sets their own password; nobody else ever knows it.
export default function AcceptInvite() {
  const token = useSearchParams()[0].get('token') ?? '';
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let ignore = false;
    getInvitation(token)
      .then((result) => !ignore && setInvitation(result))
      .catch((err) => !ignore && setFetchError(getErrorMessage(err)));
    return () => {
      ignore = true;
    };
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await acceptInvitation(token, password);
      navigate('/login', { replace: true, state: { message: 'Your account is ready. Please log in.' } });
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  const loadError = token ? fetchError : 'This link is missing its token. Please use the link from the email.';
  if (loadError) {
    return (
      <Card title="Invitation" titleLevel={1}>
        <Alert type="error">{loadError}</Alert>
        <Muted>Please ask the clinic administrator to send you a new invitation.</Muted>
        <p className="card-footer">
          <ButtonLink to="/login" variant="tertiary" size="sm">
            Go to log in
          </ButtonLink>
        </p>
      </Card>
    );
  }

  if (!invitation) return <Muted>Checking invitation…</Muted>;

  return (
    <Card
      title={`Welcome, ${invitation.name}`}
      titleLevel={1}
      description="You have been invited to join the clinic. Choose a password to activate your account."
      onSubmit={handleSubmit}
    >
      <dl className="details">
        <dt>Email</dt>
        <dd>{invitation.email}</dd>
        <dt>Specialty</dt>
        <dd>{invitation.specialty}</dd>
      </dl>
      <Field label="Password" hint="At least 8 characters.">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" autoFocus />
      </Field>
      <Field label="Confirm password">
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
      </Field>
      <Alert type="error">{error}</Alert>
      <Button type="submit" block disabled={submitting}>
        {submitting ? 'Creating account…' : 'Create my account'}
      </Button>
    </Card>
  );
}
