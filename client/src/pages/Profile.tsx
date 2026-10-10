import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { changePassword } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { updateMyProfile } from '../api/doctor';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, FormActions } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { PasswordInput } from '../components/ui/PasswordInput';
import { useAuth } from '../context/AuthContext';
import { useFieldErrors } from '../hooks/useFieldErrors';
import { useToast } from '../hooks/useToast';
import { BIO_MAX_LENGTH, MIN_PASSWORD_LENGTH, PASSWORD_HINT } from '../utils/limits';
import { ROLE_LABELS } from '../utils/roles';
import { checkConfirmPassword, checkNewPassword, required } from '../utils/validation';

// "Change password" in the user menu links here: /profile#change-password
const PASSWORD_SECTION_ID = 'change-password';

// Doctors only: the short text patients read on the doctor's page (/doctors/:id).
// Name and specialty are changed by the admin.
function BioCard({ bio }: { bio: string | null }) {
  const { refresh } = useAuth();
  const [value, setValue] = useState(bio ?? '');
  const [error, setError] = useState('');
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await updateMyProfile({ bio: value });
      await refresh(); // the user in the app now has the new bio
      toast.success(value.trim() ? 'Bio saved.' : 'Bio removed.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="About you" description="Patients read this on your page before they book." onSubmit={handleSubmit}>
      <Field label="Bio" hint={`Optional, up to ${BIO_MAX_LENGTH} characters.`}>
        <textarea value={value} onChange={(e) => setValue(e.target.value)} maxLength={BIO_MAX_LENGTH} rows={4} />
      </Field>
      <Alert type="error">{error}</Alert>
      <FormActions>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save bio'}
        </Button>
      </FormActions>
    </Card>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const location = useLocation();
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const toast = useToast();
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
      toast.success('Password changed. You were logged out on your other devices.');
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

      {user.role === 'doctor' && <BioCard bio={user.bio} />}

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
        <FormActions>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Change password'}
          </Button>
        </FormActions>
      </Card>
    </div>
  );
}
