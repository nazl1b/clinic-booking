// Cancelling an appointment (or removing blocked time) from the doctor's and the
// admin's pages: the same confirm dialog, the same toasts and the same busy state
// everywhere. Phone appointments have no email, so the staff member is reminded
// to call the patient.

import { useState } from 'react';
import { getErrorMessage } from '../api/client';
import type { ConfirmOptions } from '../context/confirm';
import type { Appointment } from '../types';
import { formatDate } from '../utils/dates';
import { useConfirm } from './useConfirm';
import { useToast } from './useToast';

interface Options {
  cancel: (id: number) => Promise<void>; // the doctor's or the admin's endpoint
  onCancelled: () => void; // e.g. reload the list
  showDoctor?: boolean; // admin: name the doctor in the question
}

function question(a: Appointment, showDoctor: boolean): ConfirmOptions {
  const when = `on ${formatDate(a.date)} at ${a.time}`;
  if (a.kind === 'block') {
    return {
      title: 'Remove this blocked time?',
      message: `The blocked time${showDoctor ? ` of ${a.doctorName}` : ''} ${when} becomes free for booking again.`,
      confirmLabel: 'Remove blocked time',
    };
  }
  const patient = a.kind === 'online' ? a.patientName : a.guestName;
  const who = showDoctor ? `of ${patient} with ${a.doctorName}` : `with ${patient}`;
  const notice = a.kind === 'online' ? 'The patient will be notified by email.' : `Please call the patient (${a.guestPhone}) to let them know.`;
  return {
    title: 'Cancel this appointment?',
    message: `The appointment ${who} ${when} will be cancelled. ${notice}`,
    confirmLabel: 'Cancel appointment',
    cancelLabel: 'Keep appointment',
  };
}

function successMessage(a: Appointment): string {
  if (a.kind === 'block') return 'Blocked time removed.';
  if (a.kind === 'online') return 'Appointment cancelled. The patient was emailed.';
  return `Appointment cancelled. Remember to call ${a.guestName} (${a.guestPhone}).`;
}

export function useStaffCancel({ cancel, onCancelled, showDoctor = false }: Options) {
  const confirm = useConfirm();
  const toast = useToast();
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  async function handleCancel(a: Appointment) {
    if (!(await confirm(question(a, showDoctor)))) return;
    setCancellingId(a.id);
    try {
      await cancel(a.id);
      toast.success(successMessage(a));
      onCancelled();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  }

  return { handleCancel, cancellingId };
}
