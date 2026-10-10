import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { PasswordInput } from '../components/ui/PasswordInput';
import { useAuth } from '../hooks/useAuth';
import { useFieldErrors } from '../hooks/useFieldErrors';
import { MIN_PASSWORD_LENGTH, NAME_MAX_LENGTH, PASSWORD_HINT } from '../utils/limits';
import { checkConfirmPassword, checkEmail, checkNewPassword, required } from '../utils/validation';

// Patient sign-up. Doctors join by invitation and admins come from the seed script.
export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { errors, validate } = useFieldErrors<'name' | 'email' | 'password' | 'confirm'>();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const valid = validate(e.currentTarget, {
      name: required(name, 'Please enter your full name.'),
      email: checkEmail(email),
      password: checkNewPassword(password),
      confirm: checkConfirmPassword(confirm, password),
    });
    if (!valid) return;
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/doctors', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <Card title="Create an account" titleLevel={1} onSubmit={handleSubmit}>
      <Field label="Full name" error={errors.name}>
        <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" maxLength={NAME_MAX_LENGTH} />
      </Field>
      <Field label="Email" error={errors.email}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </Field>
      <PasswordInput
        label="Password"
        hint={PASSWORD_HINT}
        error={errors.password}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={MIN_PASSWORD_LENGTH}
        autoComplete="new-password"
      />
      <PasswordInput
        label="Confirm password"
        error={errors.confirm}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        autoComplete="new-password"
      />
      <Alert type="error">{error}</Alert>
      <Button type="submit" block disabled={submitting}>
        {submitting ? 'Creating account…' : 'Create account'}
      </Button>
      <p className="card-footer">
        Already have an account?{' '}
        <ButtonLink to="/login" variant="tertiary" size="sm">
          Log in
        </ButtonLink>
      </p>
    </Card>
  );
}
