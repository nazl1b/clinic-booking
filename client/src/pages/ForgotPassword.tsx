import { useState, type FormEvent } from 'react';
import { forgotPassword } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field } from '../components/ui/Field';
import { useFieldErrors } from '../hooks/useFieldErrors';
import { PASSWORD_RESET_HOURS } from '../utils/limits';
import { plural } from '../utils/text';
import { checkEmail } from '../utils/validation';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { errors, validate } = useFieldErrors<'email'>();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!validate(e.currentTarget, { email: checkEmail(email) })) return;
    setSubmitting(true);
    try {
      // The API answers the same way whether the email exists or not.
      setMessage(await forgotPassword(email));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      title="Forgot password"
      titleLevel={1}
      description={
        message ? undefined : `Enter your email and we will send you a link to set a new password. The link is valid for ${plural(PASSWORD_RESET_HOURS, 'hour')}.`
      }
      onSubmit={handleSubmit}
    >
      {message ? (
        <Alert type="success">{message}</Alert>
      ) : (
        <>
          <Field label="Email" error={errors.email}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
          </Field>
          <Alert type="error">{error}</Alert>
          <Button type="submit" block disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </>
      )}
      <p className="card-footer">
        <ButtonLink to="/login" variant="tertiary" size="sm">
          Back to log in
        </ButtonLink>
      </p>
    </Card>
  );
}
