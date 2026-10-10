import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  cancelInvitation,
  deactivateDoctor,
  getAllDoctors,
  getInvitations,
  getUpcomingCount,
  inviteDoctor,
  reactivateDoctor,
  resendInvitation,
  updateDoctor,
} from '../api/admin';
import { getErrorMessage } from '../api/client';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, FormActions, FormRow } from '../components/ui/Field';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import { ActionsCell, Table } from '../components/ui/Table';
import { useConfirm } from '../hooks/useConfirm';
import { useFieldErrors } from '../hooks/useFieldErrors';
import { useToast } from '../hooks/useToast';
import type { DeactivationResult, Doctor, Invitation } from '../types';
import { formatDate, formatTimestamp } from '../utils/dates';
import { BIO_MAX_LENGTH, INVITATION_HOURS, NAME_MAX_LENGTH, SPECIALTY_MAX_LENGTH } from '../utils/limits';
import { plural } from '../utils/text';
import { checkEmail, required } from '../utils/validation';

export default function AdminDoctors() {
  const confirm = useConfirm();
  const toast = useToast();
  // Both lists are null until loaded; loadError replaces them when loading fails.
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [invitations, setInvitations] = useState<(Invitation & { expired: boolean })[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null); // e.g. "invite-3", "doctor-2"

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteSpecialty, setInviteSpecialty] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const { errors: inviteErrors, validate: validateInvite } = useFieldErrors<'name' | 'specialty' | 'email'>();

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editBio, setEditBio] = useState('');

  // Deactivation: phone appointments the admin has to call (shown until closed)
  const [deactivationResult, setDeactivationResult] = useState<(DeactivationResult & { doctorName: string }) | null>(null);

  const load = useCallback(() => {
    Promise.all([getAllDoctors(), getInvitations()])
      .then(([doctorList, invitationList]) => {
        setDoctors(doctorList);
        const now = Date.now();
        setInvitations(invitationList.map((i) => ({ ...i, expired: new Date(i.expiresAt).getTime() < now })));
        setLoadError('');
      })
      .catch((err) => setLoadError(getErrorMessage(err)));
  }, []);

  useEffect(load, [load]);

  // Runs an action, shows its success or error as a toast, then reloads the lists.
  // Returns true on success.
  async function run(id: string, action: () => Promise<unknown>, message: string): Promise<boolean> {
    setBusyId(id);
    try {
      await action();
      toast.success(message);
      load();
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviteError('');
    const valid = validateInvite(e.currentTarget, {
      name: required(inviteName, "Please enter the doctor's name."),
      specialty: required(inviteSpecialty, 'Please enter the specialty.'),
      email: checkEmail(inviteEmail),
    });
    if (!valid) return;
    setInviting(true);
    try {
      const invitation = await inviteDoctor({ name: inviteName, specialty: inviteSpecialty, email: inviteEmail });
      toast.success(`Invitation sent to ${invitation.email}. The link is valid for ${plural(INVITATION_HOURS, 'hour')}.`);
      setInviteName('');
      setInviteSpecialty('');
      setInviteEmail('');
      setShowInvite(false);
      load();
    } catch (err) {
      setInviteError(getErrorMessage(err));
    } finally {
      setInviting(false);
    }
  }

  function startEdit(doctor: Doctor) {
    setEditingId(doctor.id);
    setEditName(doctor.name);
    setEditSpecialty(doctor.specialty);
    setEditBio(doctor.bio ?? '');
  }

  async function saveEdit(doctorId: number) {
    const saved = await run(`doctor-${doctorId}`, () => updateDoctor(doctorId, { name: editName, specialty: editSpecialty, bio: editBio }), 'Doctor details saved.');
    if (saved) setEditingId(null);
  }

  // First how many upcoming appointments would be cancelled, then the confirm dialog.
  async function askDeactivate(doctor: Doctor) {
    const opener = document.activeElement as HTMLElement | null; // the button is disabled while counting
    setDeactivationResult(null);
    setBusyId(`doctor-${doctor.id}`);
    let upcomingCount: number;
    try {
      upcomingCount = await getUpcomingCount(doctor.id);
    } catch (err) {
      toast.error(getErrorMessage(err));
      return;
    } finally {
      setBusyId(null);
    }

    const confirmed = await confirm({
      title: `Deactivate ${doctor.name}?`,
      message: (
        <>
          {upcomingCount > 0 ? (
            <p>
              This doctor has <strong>{plural(upcomingCount, 'upcoming appointment')}</strong>. They will all be cancelled. Patients with an account will be
              emailed; you will get a list of phone appointments to call.
            </p>
          ) : (
            <p>This doctor has no upcoming appointments.</p>
          )}
          <p>The doctor will be logged out and can no longer log in. Past appointments stay as history. You can reactivate the account later.</p>
        </>
      ),
      confirmLabel: 'Deactivate doctor',
      cancelLabel: 'Keep active',
      returnFocus: opener,
    });
    if (!confirmed) return;

    setBusyId(`doctor-${doctor.id}`);
    try {
      const result = await deactivateDoctor(doctor.id);
      const summary = `${plural(result.cancelledCount, 'appointment')} cancelled · ${plural(result.emailedCount, 'patient email')} sent.`;
      toast.success(`${doctor.name} was deactivated. ${summary}`);
      // Phone appointments have no email: their list stays on the page until closed.
      if (result.phoneContacts.length > 0) setDeactivationResult({ ...result, doctorName: doctor.name });
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function askCancelInvitation(inv: Invitation) {
    const confirmed = await confirm({
      title: 'Cancel this invitation?',
      message: `The link sent to ${inv.email} will stop working.`,
      confirmLabel: 'Cancel invitation',
      cancelLabel: 'Keep invitation',
    });
    if (confirmed) await run(`invite-${inv.id}`, () => cancelInvitation(inv.id), 'Invitation cancelled.');
  }

  return (
    <div className="page">
      <PageHeader
        title="Doctors"
        description="Invite doctors, edit their details or deactivate them."
        actions={!showInvite && <Button onClick={() => setShowInvite(true)}>Invite doctor</Button>}
      />
      <Alert type="error">{loadError}</Alert>

      {deactivationResult && (
        <Card
          title={`${deactivationResult.doctorName} was deactivated`}
          description={`${plural(deactivationResult.cancelledCount, 'appointment')} cancelled · ${plural(deactivationResult.emailedCount, 'patient email')} sent.`}
          actions={
            <Button variant="tertiary" size="sm" onClick={() => setDeactivationResult(null)}>
              Close
            </Button>
          }
        >
          {deactivationResult.phoneContacts.length > 0 && (
            <>
              <Alert type="warning">These patients booked by phone and have no email. Please call them:</Alert>
              <Table columns={[{ label: 'Patient' }, { label: 'Phone' }, { label: 'Was booked for' }]}>
                {deactivationResult.phoneContacts.map((c) => (
                  <tr key={c.appointmentId}>
                    <td>{c.guestName}</td>
                    <td>
                      <a href={`tel:${c.guestPhone}`}>{c.guestPhone}</a>
                    </td>
                    <td>
                      {formatDate(c.date)} at {c.time}
                    </td>
                  </tr>
                ))}
              </Table>
            </>
          )}
        </Card>
      )}

      {showInvite && (
        <Card title="Invite a doctor" description="The doctor gets an email with a link to set their own password. You never see or set it." onSubmit={handleInvite}>
          <FormRow>
            <Field label="Name" error={inviteErrors.name}>
              <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} required placeholder="Dr. …" maxLength={NAME_MAX_LENGTH} autoFocus />
            </Field>
            <Field label="Specialty" error={inviteErrors.specialty}>
              <input value={inviteSpecialty} onChange={(e) => setInviteSpecialty(e.target.value)} required maxLength={SPECIALTY_MAX_LENGTH} />
            </Field>
            <Field label="Email" error={inviteErrors.email}>
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
            </Field>
          </FormRow>
          <Alert type="error">{inviteError}</Alert>
          <FormActions>
            <Button type="submit" disabled={inviting}>
              {inviting ? 'Sending…' : 'Send invitation'}
            </Button>
            <Button variant="tertiary" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
          </FormActions>
        </Card>
      )}

      {!loadError && (
        <Card title="Pending invitations">
          {!invitations ? (
            <Muted>Loading…</Muted>
          ) : invitations.length === 0 ? (
            <Muted>No pending invitations.</Muted>
          ) : (
            <Table columns={[{ label: 'Name' }, { label: 'Specialty' }, { label: 'Email' }, { label: 'Expires' }, { label: 'Actions', align: 'right', hidden: true }]}>
              {invitations.map((inv) => {
                const busy = busyId === `invite-${inv.id}`;
                return (
                  <tr key={inv.id}>
                    <td>{inv.name}</td>
                    <td>{inv.specialty}</td>
                    <td>{inv.email}</td>
                    <td className="nowrap">{inv.expired ? <Badge tone="danger">Expired</Badge> : formatTimestamp(inv.expiresAt)}</td>
                    <ActionsCell>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => run(`invite-${inv.id}`, () => resendInvitation(inv.id), `New link sent to ${inv.email}. The old link no longer works.`)}
                      >
                        Resend
                      </Button>
                      <Button
                        variant="tertiary"
                        size="sm"
                        danger
                        disabled={busy}
                        onClick={() => askCancelInvitation(inv)}
                      >
                        Cancel
                      </Button>
                    </ActionsCell>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>

      )}

      {!loadError && (
        <Card title="All doctors">
          {!doctors ? (
            <Muted>Loading…</Muted>
          ) : doctors.length === 0 ? (
            <Muted>No doctors yet. Invite a doctor to get started.</Muted>
          ) : (
            <Table columns={[{ label: 'Name' }, { label: 'Specialty' }, { label: 'Email' }, { label: 'Status' }, { label: 'Actions', align: 'right', hidden: true }]}>
              {doctors.map((doctor) => {
                const busy = busyId === `doctor-${doctor.id}`;
                const editing = editingId === doctor.id;
                const rowClass = [!doctor.isActive && 'row-muted', editing && 'row-editing'].filter(Boolean).join(' ') || undefined;
                return (
                  <Fragment key={doctor.id}>
                    <tr className={rowClass}>
                      <td>{editing ? <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={NAME_MAX_LENGTH} aria-label="Name" /> : doctor.name}</td>
                      <td>{editing ? <input value={editSpecialty} onChange={(e) => setEditSpecialty(e.target.value)} maxLength={SPECIALTY_MAX_LENGTH} aria-label="Specialty" /> : doctor.specialty}</td>
                      <td>{doctor.email}</td>
                      <td>
                        <Badge tone={doctor.isActive ? 'primary' : 'neutral'}>{doctor.isActive ? 'Active' : 'Deactivated'}</Badge>
                      </td>
                      <ActionsCell>
                        {editing ? (
                          <>
                            <Button size="sm" disabled={busy} onClick={() => saveEdit(doctor.id)}>
                              Save
                            </Button>
                            <Button variant="tertiary" size="sm" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="secondary" size="sm" onClick={() => startEdit(doctor)}>
                              Edit
                            </Button>
                            {doctor.isActive ? (
                              <Button variant="tertiary" size="sm" danger disabled={busy} onClick={() => askDeactivate(doctor)}>
                                Deactivate
                              </Button>
                            ) : (
                              <Button
                                variant="tertiary"
                                size="sm"
                                disabled={busy}
                                onClick={() => run(`doctor-${doctor.id}`, () => reactivateDoctor(doctor.id), `${doctor.name} is active again.`)}
                              >
                                Reactivate
                              </Button>
                            )}
                          </>
                        )}
                      </ActionsCell>
                    </tr>
                    {/* The bio is longer than a cell: it gets a row of its own while editing */}
                    {editing && (
                      <tr className="row-edit">
                        <td colSpan={5}>
                          <Field label="Bio" hint={`Shown to patients on the doctor's page. Optional, up to ${BIO_MAX_LENGTH} characters.`}>
                            <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} maxLength={BIO_MAX_LENGTH} rows={3} />
                          </Field>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
