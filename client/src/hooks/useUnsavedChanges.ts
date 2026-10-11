// A form with something typed but not saved: leaving the page asks first
// (ConfirmDialog for links, the sidebar and Back; the browser's own warning on
// refresh or closing the tab). See UnsavedChangesProvider.
//
//   const allowLeaving = useUnsavedChanges(name !== '' || note !== '');
//   …after saving: allowLeaving(); navigate('/somewhere');
//
// Several forms on one page each call it; the page asks if any of them is dirty.

import { useContext, useEffect, useId } from 'react';
import { UnsavedChangesContext } from '../context/unsavedChanges';

export function useUnsavedChanges(dirty: boolean): () => void {
  const context = useContext(UnsavedChangesContext);
  if (!context) throw new Error('useUnsavedChanges must be used inside <UnsavedChangesProvider>');
  const { setDirty, allowLeaving } = context;
  const formId = useId();

  useEffect(() => {
    setDirty(formId, dirty);
    return () => setDirty(formId, false); // the form is gone: nothing left to lose
  }, [setDirty, formId, dirty]);

  return allowLeaving;
}
