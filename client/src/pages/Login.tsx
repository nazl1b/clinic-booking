import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { PasswordInput } from '../components/ui/PasswordInput';
import { homePathFor, useAuth } from '../context/AuthContext';
import { useFieldErrors } from '../hooks/useFieldErrors';
import { DEMO_ACCOUNTS, type DemoAccount } from '../utils/demo';
import { ROLE_LABELS } from '../utils/roles';
import { checkEmail, required } from '../utils/validation';

interface LoginState {
  from?: string; // page the user tried to open before logging in
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as LoginState;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { errors, validate, clear: clearErrors } = useFieldErrors<'email' | 'password'>();

  // Only fills in the form: the visitor still presses Log in.
  function fillDemo(account: DemoAccount) {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
    clearErrors();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!validate(e.currentTarget, { email: checkEmail(email), password: required(password, 'Please enter your password.') })) return;
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
    <>
      <Card title="Log in" titleLevel={1} onSubmit={handleSubmit}>
        <Field label="Email" error={errors.email}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
        </Field>
        <PasswordInput
          label="Password"
          error={errors.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <div className="field-aside">
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

      <Card
        title="Try a demo account"
        actions={DEMO_ACCOUNTS.map((account) => (
          <Button key={account.role} variant="secondary" size="sm" onClick={() => fillDemo(account)}>
            {ROLE_LABELS[account.role]}
          </Button>
        ))}
      />
    </>
  );
}
