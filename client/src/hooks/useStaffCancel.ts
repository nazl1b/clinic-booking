// Cancelling an appointment (or removing blocked time) from the doctor's and the
// admin's pages: the same question, the same messages and the same busy state
// everywhere. Phone appointments have no email, so the staff member is reminded
// to call the patient.

import { useState } from 'react';
import { getErrorMessage } from '../api/client';
import type { Appointment } from '../types';
import { formatDate } from '../utils/dates';

interface Options {
  cancel: (id: number) => Promise<void>; // the doctor's or the admin's endpoint
  onCancelled: () => void; // e.g. reload the list
  showDoctor?: boolean; // admin: name the doctor in the question
}

function question(a: Appointment, showDoctor: boolean): string {
  const when = `on ${formatDate(a.date)} at ${a.time}`;
  if (a.kind === 'block') return `Remove the blocked time${showDoctor ? ` of ${a.doctorName}` : ''} ${when}?`;
  const patient = a.kind === 'online' ? a.patientName : a.guestName;
  const who = showDoctor ? `of ${patient} with ${a.doctorName}` : `with ${patient}`;
  const notice = a.kind === 'online' ? 'The patient will be notified by email.' : `Please call the patient (${a.guestPhone}) to let them know.`;
  return `Cancel the appointment ${who} ${when}? ${notice}`;
}

function successMessage(a: Appointment): string {
  if (a.kind === 'block') return 'Blocked time removed.';
  if (a.kind === 'online') return 'Appointment cancelled. The patient was emailed.';
  return `Appointment cancelled. Remember to call ${a.guestName} (${a.guestPhone}).`;
}

export function useStaffCancel({ cancel, onCancelled, showDoctor = false }: Options) {
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleCancel(a: Appointment) {
    if (!window.confirm(question(a, showDoctor))) return;
    setError('');
    setSuccess('');
    setCancellingId(a.id);
    try {
      await cancel(a.id);
      setSuccess(successMessage(a));
      onCancelled();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  }

  function clearMessages() {
    setError('');
    setSuccess('');
  }

  return { handleCancel, cancellingId, error, success, clearMessages };
}
