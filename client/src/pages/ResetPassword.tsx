import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PasswordInput } from '../components/ui/PasswordInput';
import { useAuth } from '../context/AuthContext';
import { useFieldErrors } from '../hooks/useFieldErrors';
import { MIN_PASSWORD_LENGTH, MISSING_TOKEN, PASSWORD_HINT } from '../utils/limits';
import { checkConfirmPassword, checkNewPassword } from '../utils/validation';

// Opened from the email link: /reset-password?token=...
export default function ResetPassword() {
  const token = useSearchParams()[0].get('token') ?? '';
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { errors, validate } = useFieldErrors<'password' | 'confirm'>();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!validate(e.currentTarget, { password: checkNewPassword(password), confirm: checkConfirmPassword(confirm, password) })) return;
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
        <Alert type="error">{MISSING_TOKEN}</Alert>
        {newLinkButton}
      </Card>
    );
  }

  return (
    <Card title="Set a new password" titleLevel={1} onSubmit={handleSubmit}>
      <PasswordInput
        label="New password"
        hint={PASSWORD_HINT}
        error={errors.password}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={MIN_PASSWORD_LENGTH}
        autoComplete="new-password"
        autoFocus
      />
      <PasswordInput
        label="Confirm new password"
        error={errors.confirm}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        autoComplete="new-password"
      />
      <Alert type="error">{error}</Alert>
      <Button type="submit" block disabled={submitting}>
        {submitting ? 'Saving…' : 'Save new password'}
      </Button>
      {newLinkButton}
    </Card>
  );
}
