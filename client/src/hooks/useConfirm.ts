// Asks before a destructive action, in a ConfirmDialog instead of window.confirm:
//   const confirm = useConfirm();
//   if (!(await confirm({ title: 'Cancel this appointment?', confirmLabel: 'Cancel appointment' }))) return;
// Resolves true when the user confirms, false on the other button, Escape or a click outside.

import { useContext } from 'react';
import { ConfirmContext, type Confirm } from '../context/confirm';

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return confirm;
}
