import { Fragment, useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  cancelInvitation,
  deactivateDoctor,
  getDoctorsPage,
  getInvitations,
  getUpcomingCount,
  reactivateDoctor,
  resendInvitation,
  updateDoctor,
} from '../api/admin';
import { getErrorMessage } from '../api/client';
import { FilterToolbar } from '../components/FilterToolbar';
import { SpecialtyInput } from '../components/SpecialtyInput';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CharacterCount } from '../components/ui/CharacterCount';
import { EmptyState } from '../components/ui/EmptyState';
import { Field } from '../components/ui/Field';
import { Muted, PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { ActionsCell, Table } from '../components/ui/Table';
import { useConfirm } from '../hooks/useConfirm';
import { type ListFilters, usePagedList } from '../hooks/usePagedList';
import { useSpecialties } from '../hooks/useSpecialties';
import { useToast } from '../hooks/useToast';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import type { DeactivationResult, Doctor, Invitation } from '../types';
import { formatDate, formatTimestamp } from '../utils/dates';
import { BIO_MAX_LENGTH, NAME_MAX_LENGTH, SPECIALTY_MAX_LENGTH } from '../utils/limits';
import { plural } from '../utils/text';
import type { InviteDoctorState } from './InviteDoctor';

// Both lists are searched and paged by the server; their search, filter and page
// are in the URL (?invitationsSearch=…&invitationsPage=2&doctorsSearch=…&doctorsStatus=active&doctorsPage=3).
const INVITATION_FILTERS = ['search'] as const;
const DOCTOR_FILTERS = ['search', 'status'] as const;
const INVITATIONS_PAGE_SIZE = 10; // a shorter list above the doctors

// Loaded, nothing in it and no search or filter: only its EmptyState is shown.
const isEmptyList = (list: { page: { total: number } | null; isFiltered: boolean }) => list.page !== null && list.page.total === 0 && !list.isFiltered;

async function fetchInvitations(filters: ListFilters<'search'>, page: number) {
  const result = await getInvitations({ search: filters.search || undefined, page, pageSize: INVITATIONS_PAGE_SIZE });
  const now = Date.now();
  return { ...result, items: result.items.map((i) => ({ ...i, expired: new Date(i.expiresAt).getTime() < now })) };
}

function fetchDoctors(filters: ListFilters<'search' | 'status'>, page: number) {
  const status = filters.status === 'active' || filters.status === 'deactivated' ? filters.status : undefined;
  return getDoctorsPage({ search: filters.search || undefined, status, page });
}

export default function AdminDoctors() {
  const confirm = useConfirm();
  const toast = useToast();
  const invitationList = usePagedList('invitations', INVITATION_FILTERS, fetchInvitations);
  const doctorList = usePagedList('doctors', DOCTOR_FILTERS, fetchDoctors);
  const [busyId, setBusyId] = useState<string | null>(null); // e.g. "invite-3", "doctor-2"

  const navigate = useNavigate();
  const location = useLocation();
  const [specialtiesKey, setSpecialtiesKey] = useState(0); // reloads the suggestions after a save
  const specialties = useSpecialties(specialtiesKey);

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editStart, setEditStart] = useState({ name: '', specialty: '', bio: '' }); // the values when editing began

  // Unsaved changes in the doctor being edited: leaving the page asks first.
  useUnsavedChanges(editingId !== null && (editName !== editStart.name || editSpecialty !== editStart.specialty || editBio !== editStart.bio));

  // Deactivation: phone appointments the admin has to call (shown until closed)
  const [deactivationResult, setDeactivationResult] = useState<(DeactivationResult & { doctorName: string }) | null>(null);

  const { update: updateInvitations } = invitationList;
  const { update: updateDoctors } = doctorList;
  const searchInvitations = useCallback((search: string) => updateInvitations({ search }, { replace: true }), [updateInvitations]);
  const searchDoctors = useCallback((search: string) => updateDoctors({ search }, { replace: true }), [updateDoctors]);

  // After an action: both lists, since e.g. an accepted invitation becomes a doctor.
  function load() {
    invitationList.reload();
    doctorList.reload();
  }

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

  // The invite form has its own page; it comes back to this list afterwards.
  function openInvite() {
    const state: InviteDoctorState = { from: location.pathname + location.search };
    navigate('/admin/doctors/invite', { state });
  }

  function startEdit(doctor: Doctor) {
    setEditingId(doctor.id);
    setEditName(doctor.name);
    setEditSpecialty(doctor.specialty);
    setEditBio(doctor.bio ?? '');
    setEditStart({ name: doctor.name, specialty: doctor.specialty, bio: doctor.bio ?? '' });
  }

  async function saveEdit(doctorId: number) {
    const saved = await run(`doctor-${doctorId}`, () => updateDoctor(doctorId, { name: editName, specialty: editSpecialty, bio: editBio }), 'Doctor details saved.');
    if (saved) {
      setEditingId(null);
      setSpecialtiesKey((k) => k + 1);
    }
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
        actions={<Button onClick={openInvite}>Invite doctor</Button>}
      />
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

      <Card
        title="Pending invitations"
        actions={
          !isEmptyList(invitationList) && (
            <FilterToolbar
              searchLabel="Search invitations"
              placeholder="Search name, specialty or email"
              search={invitationList.filters.search}
              onSearch={searchInvitations}
            />
          )
        }
      >
        <Alert type="error">{invitationList.error}</Alert>
        {invitationList.error ? null : !invitationList.page ? (
          <Muted>Loading…</Muted>
        ) : (
          <div className={`results${invitationList.busy ? ' results-busy' : ''}`} aria-busy={invitationList.busy}>
            {invitationList.page.items.length === 0 ? (
              invitationList.isFiltered ? (
                <EmptyState
                  icon="search"
                  title="No invitations match this search"
                  text="Try another search or clear it."
                  action={
                    <Button variant="secondary" onClick={invitationList.clear}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState icon="user" title="No pending invitations" text="Invitations you send are listed here until the doctor accepts them." />
              )
            ) : (
              <Table columns={[{ label: 'Name' }, { label: 'Specialty' }, { label: 'Email' }, { label: 'Expires' }, { label: 'Actions', align: 'right', hidden: true }]}>
                {invitationList.page.items.map((inv) => {
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
                          variant="secondary"
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
            <Pagination page={invitationList.page.page} pageSize={invitationList.page.pageSize} total={invitationList.page.total} onChange={invitationList.setPage} />
          </div>
        )}
      </Card>

      <Card
        title="All doctors"
        actions={
          !isEmptyList(doctorList) && (
            <FilterToolbar
              searchLabel="Search doctors"
              placeholder="Search name, specialty or email"
              search={doctorList.filters.search}
              onSearch={searchDoctors}
              activeFilters={doctorList.filters.status ? 1 : 0}
              onClearFilters={() => doctorList.update({ status: '' })}
            >
              <Field label="Status">
                <select value={doctorList.filters.status} onChange={(e) => doctorList.update({ status: e.target.value })}>
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              </Field>
            </FilterToolbar>
          )
        }
      >
        <Alert type="error">{doctorList.error}</Alert>
        {doctorList.error ? null : !doctorList.page ? (
          <Muted>Loading…</Muted>
        ) : (
          <div className={`results${doctorList.busy ? ' results-busy' : ''}`} aria-busy={doctorList.busy}>
            {doctorList.page.items.length === 0 ? (
              doctorList.isFiltered ? (
                <EmptyState
                  icon="search"
                  title="No doctors match these filters"
                  text="Try another search or other filters."
                  action={
                    <Button variant="secondary" onClick={doctorList.clear}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon="users"
                  title="No doctors yet"
                  text="Invite a doctor to get started."
                  action={<Button onClick={openInvite}>Invite a doctor</Button>}
                />
              )
            ) : (
              <Table columns={[{ label: 'Name' }, { label: 'Specialty' }, { label: 'Email' }, { label: 'Status' }, { label: 'Actions', align: 'right', hidden: true }]}>
                {doctorList.page.items.map((doctor) => {
                  const busy = busyId === `doctor-${doctor.id}`;
                  const editing = editingId === doctor.id;
                  const rowClass = [!doctor.isActive && 'row-muted', editing && 'row-editing'].filter(Boolean).join(' ') || undefined;
                  return (
                    <Fragment key={doctor.id}>
                      <tr className={rowClass}>
                        <td>
                          {editing ? (
                            <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={NAME_MAX_LENGTH} aria-label="Name" />
                          ) : (
                            <ButtonLink to={`/doctors/${doctor.id}`} variant="tertiary">
                              {doctor.name}
                            </ButtonLink>
                          )}
                        </td>
                        <td>{editing ? <SpecialtyInput value={editSpecialty} onChange={setEditSpecialty} suggestions={specialties} maxLength={SPECIALTY_MAX_LENGTH} aria-label="Specialty" /> : doctor.specialty}</td>
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
                              <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="secondary" size="sm" onClick={() => startEdit(doctor)}>
                                Edit
                              </Button>
                              {doctor.isActive ? (
                                <Button variant="secondary" size="sm" danger disabled={busy} onClick={() => askDeactivate(doctor)}>
                                  Deactivate
                                </Button>
                              ) : (
                                <Button
                                  variant="secondary"
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
                            <Field
                              label="Bio"
                              hint={
                                <>
                                  Shown to patients on the doctor's page. <CharacterCount length={editBio.length} max={BIO_MAX_LENGTH} />
                                </>
                              }
                            >
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
            <Pagination page={doctorList.page.page} pageSize={doctorList.page.pageSize} total={doctorList.page.total} onChange={doctorList.setPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
