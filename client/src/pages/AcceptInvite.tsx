import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { acceptInvitation, getInvitation } from '../api/invitations';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormActions } from '../components/ui/Field';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Muted } from '../components/ui/PageHeader';
import { homePathFor, useAuth } from '../context/AuthContext';
import type { InvitationPreview } from '../types';
import { MIN_PASSWORD_LENGTH, MISSING_TOKEN, PASSWORD_HINT, PASSWORD_MISMATCH } from '../utils/limits';

// Opened from the invitation email: /accept-invite?token=...
// The doctor sets their own password; nobody else ever knows it.
// Someone already logged in (e.g. the admin testing the link) must log out first.
export default function AcceptInvite() {
  const { user, loading: authLoading, logout } = useAuth();
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
      setError(PASSWORD_MISMATCH);
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

  if (user) {
    return (
      <Card title="Invitation" titleLevel={1}>
        <Alert type="warning">
          You are logged in as {user.name} ({user.email}). Please log out first to accept this invitation.
        </Alert>
        <Alert type="error">{error}</Alert>
        <FormActions>
          <Button onClick={() => logout().catch((err) => setError(getErrorMessage(err)))}>Log out</Button>
          <ButtonLink to={homePathFor(user.role)} variant="tertiary">
            Go to your home page
          </ButtonLink>
        </FormActions>
      </Card>
    );
  }

  const loadError = token ? fetchError : MISSING_TOKEN;
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

  if (authLoading || !invitation) {
    return (
      <Card title="Invitation" titleLevel={1}>
        <Muted>Checking invitation…</Muted>
      </Card>
    );
  }

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
      <PasswordInput
        label="Password"
        hint={PASSWORD_HINT}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={MIN_PASSWORD_LENGTH}
        autoComplete="new-password"
        autoFocus
      />
      <PasswordInput
        label="Confirm password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        autoComplete="new-password"
      />
      <Alert type="error">{error}</Alert>
      <Button type="submit" block disabled={submitting}>
        {submitting ? 'Creating account…' : 'Create my account'}
      </Button>
    </Card>
  );
}
