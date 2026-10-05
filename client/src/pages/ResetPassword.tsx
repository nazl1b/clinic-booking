import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { useAuth } from '../context/AuthContext';

// Opened from the email link: /reset-password?token=...
export default function ResetPassword() {
  const token = useSearchParams()[0].get('token') ?? '';
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await resetPassword({ token, password });
      await refresh(); // all sessions of the user were logged out
      navigate('/login', { replace: true, state: { message: 'Your password was changed. Please log in.' } });
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  const newLinkButton = (
    <p className="card-footer">
      <ButtonLink to="/forgot-password" variant="tertiary" size="sm">
        Request a new link
      </ButtonLink>
    </p>
  );

  if (!token) {
    return (
      <Card title="Reset password" titleLevel={1}>
        <Alert type="error">This link is missing its token. Please use the link from the email.</Alert>
        {newLinkButton}
      </Card>
    );
  }

  return (
    <Card title="Set a new password" titleLevel={1} onSubmit={handleSubmit}>
      <Field label="New password" hint="At least 8 characters.">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" autoFocus />
      </Field>
      <Field label="Confirm new password">
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
      </Field>
      <Alert type="error">{error}</Alert>
      <Button type="submit" block disabled={submitting}>
        {submitting ? 'Saving…' : 'Save new password'}
      </Button>
      {newLinkButton}
    </Card>
  );
}
