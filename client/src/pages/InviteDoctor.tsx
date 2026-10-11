// Invite a doctor, on its own page (/admin/doctors/invite): the doctor gets an
// email with a link to set their own password. The page that opened it passes
// in the router state where to go back to (`from`); sending or cancelling goes back there.

import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { inviteDoctor } from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Icon } from '../components/layout/Icon';
import { SpecialtyInput } from '../components/SpecialtyInput';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, FormActions, FormRow } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { useFieldErrors } from '../hooks/useFieldErrors';
import { useSpecialties } from '../hooks/useSpecialties';
import { useToast } from '../hooks/useToast';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { INVITATION_HOURS, NAME_MAX_LENGTH, SPECIALTY_MAX_LENGTH } from '../utils/limits';
import { plural } from '../utils/text';
import { checkEmail, required } from '../utils/validation';

// Router state set by the page that links here.
export interface InviteDoctorState {
  from?: string; // path + query to return to, e.g. "/admin/doctors?doctorsPage=2"
}

export default function InviteDoctor() {
  const navigate = useNavigate();
  const toast = useToast();
  const state = (useLocation().state ?? {}) as InviteDoctorState;
  const back = state.from ?? '/admin/doctors';
  const specialties = useSpecialties();
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const { errors, validate } = useFieldErrors<'name' | 'specialty' | 'email'>();
  // Anything typed, not sent yet: leaving the page (also Cancel) asks first.
  const allowLeaving = useUnsavedChanges([name, specialty, email].some((v) => v.trim() !== ''));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const valid = validate(e.currentTarget, {
      name: required(name, "Please enter the doctor's name."),
      specialty: required(specialty, 'Please enter the specialty.'),
      email: checkEmail(email),
    });
    if (!valid) return;
    setSending(true);
    try {
      const invitation = await inviteDoctor({ name, specialty, email });
      toast.success(`Invitation sent to ${invitation.email}. The link is valid for ${plural(INVITATION_HOURS, 'hour')}.`);
      allowLeaving();
      navigate(back);
    } catch (err) {
      setError(getErrorMessage(err));
      setSending(false);
    }
  }

  return (
    <div className="page">
      <ButtonLink to={back} variant="tertiary" size="sm">
        <Icon name="chevronLeft" size={16} />
        Back to doctors
      </ButtonLink>
      <PageHeader title="Invite a doctor" description="The doctor gets an email with a link to set their own password. You never see or set it." />
      <Card onSubmit={handleSubmit}>
        <FormRow>
          <Field label="Name" error={errors.name}>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Dr. …" maxLength={NAME_MAX_LENGTH} autoFocus />
          </Field>
          <Field label="Specialty" error={errors.specialty} hint="Choose one or type a new one.">
            <SpecialtyInput value={specialty} onChange={setSpecialty} suggestions={specialties} required maxLength={SPECIALTY_MAX_LENGTH} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
        </FormRow>
        <Alert type="error">{error}</Alert>
        <FormActions>
          <Button type="submit" disabled={sending}>
            {sending ? 'Sending…' : 'Send invitation'}
          </Button>
          <Button variant="secondary" onClick={() => navigate(back)}>
            Cancel
          </Button>
        </FormActions>
      </Card>
    </div>
  );
}
