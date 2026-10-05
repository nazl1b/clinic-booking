import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { useAuth } from '../context/AuthContext';

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
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
    <Card title="Create an account" titleLevel={1} description="Book appointments online, without a phone call." onSubmit={handleSubmit}>
      <Field label="Full name">
        <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" maxLength={100} />
      </Field>
      <Field label="Email">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="Confirm password">
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
      </Field>
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
