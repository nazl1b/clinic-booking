import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { changePassword } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormActions } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { PasswordInput } from '../components/ui/PasswordInput';
import { useAuth } from '../context/AuthContext';
import { useFieldErrors } from '../hooks/useFieldErrors';
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from '../utils/limits';
import { ROLE_LABELS } from '../utils/roles';
import { checkConfirmPassword, checkNewPassword, required } from '../utils/validation';

// "Change password" in the user menu links here: /profile#change-password
const PASSWORD_SECTION_ID = 'change-password';

export default function Profile() {
  const { user } = useAuth();
  const location = useLocation();
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { errors, validate } = useFieldErrors<'currentPassword' | 'newPassword' | 'confirm'>();

  // Coming from "Change password": scroll to the form and focus its first field.
  // location.key makes it run again when the link is used while already here.
  useEffect(() => {
    if (location.hash !== `#${PASSWORD_SECTION_ID}`) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(PASSWORD_SECTION_ID)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    currentPasswordRef.current?.focus({ preventScroll: true });
  }, [location.hash, location.key]);

  if (!user) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccess('');
    setError('');
    const valid = validate(e.currentTarget, {
      currentPassword: required(currentPassword, 'Please enter your current password.'),
      newPassword: checkNewPassword(newPassword),
      confirm: checkConfirmPassword(confirm, newPassword),
    });
    if (!valid) return;
    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setSuccess('Password changed. You were logged out on your other devices.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title="Profile" description="Your account details and password." />

      <Card title="Your details">
        <dl className="details">
          <dt>Name</dt>
          <dd>{user.name}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Role</dt>
          <dd>{ROLE_LABELS[user.role]}</dd>
          {user.specialty && (
            <>
              <dt>Specialty</dt>
              <dd>{user.specialty}</dd>
            </>
          )}
        </dl>
      </Card>

      <Card title="Change password" id={PASSWORD_SECTION_ID} onSubmit={handleSubmit}>
        <PasswordInput
          label="Current password"
          error={errors.currentPassword}
          ref={currentPasswordRef}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <PasswordInput
          label="New password"
          hint={PASSWORD_HINT}
          error={errors.newPassword}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
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
        <Alert type="success">{success}</Alert>
        <FormActions>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Change password'}
          </Button>
        </FormActions>
      </Card>
    </div>
  );
}
