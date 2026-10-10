// Short notifications on top of the page, for the result of an action:
//   const toast = useToast();
//   toast.success('Appointment cancelled.');
// Success and info close by themselves; errors stay until the user closes them.

import { useContext, useMemo } from 'react';
import { ToastContext } from '../context/toast';

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return useMemo(
    () => ({
      success: (message: string) => context.show('success', message),
      info: (message: string) => context.show('info', message),
      error: (message: string) => context.show('error', message),
    }),
    [context],
  );
}
