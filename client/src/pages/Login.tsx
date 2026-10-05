import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { homePathFor, useAuth } from '../context/AuthContext';

interface LoginState {
  from?: string; // page the user tried to open before logging in
  message?: string; // e.g. "Password changed, please log in"
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as LoginState;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(state.from ?? homePathFor(user.role), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <Card title="Log in" titleLevel={1} onSubmit={handleSubmit}>
      <Alert type="success">{state.message}</Alert>
      <Field label="Email">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
      </Field>
      <Field label="Password">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      </Field>
      <div>
        <ButtonLink to="/forgot-password" variant="tertiary" size="sm">
          Forgot password?
        </ButtonLink>
      </div>
      <Alert type="error">{error}</Alert>
      <Button type="submit" block disabled={submitting}>
        {submitting ? 'Logging in…' : 'Log in'}
      </Button>
      <p className="card-footer">
        New patient?{' '}
        <ButtonLink to="/register" variant="tertiary" size="sm">
          Create an account
        </ButtonLink>
      </p>
    </Card>
  );
}
