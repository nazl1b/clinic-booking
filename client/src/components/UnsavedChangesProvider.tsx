// Asks before leaving a page while one of its forms has unsaved changes
// (useUnsavedChanges): the shared ConfirmDialog when following a link, the
// sidebar or Back (useBlocker), the browser's own warning on refresh or closing
// the tab (beforeunload). A router allows only one blocker, so there is one here,
// around the logged-in pages, for every form.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBlocker, useLocation } from 'react-router-dom';
import { UnsavedChangesContext } from '../context/unsavedChanges';
import { useConfirm } from '../hooks/useConfirm';

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const confirm = useConfirm();
  const location = useLocation();
  const [dirtyForms, setDirtyForms] = useState<ReadonlySet<string>>(new Set());
  const dirty = dirtyForms.size > 0;

  const setDirty = useCallback(
    (formId: string, isDirty: boolean) =>
      setDirtyForms((current) => {
        if (current.has(formId) === isDirty) return current;
        const next = new Set(current);
        if (isDirty) next.add(formId);
        else next.delete(formId);
        return next;
      }),
    [],
  );

  // Set right before leaving on purpose (e.g. after saving), cleared once the page changed.
  const leavingOnPurpose = useRef(false);
  const allowLeaving = useCallback(() => {
    leavingOnPurpose.current = true;
  }, []);
  useEffect(() => {
    leavingOnPurpose.current = false;
  }, [location.key]);

  // Only another page counts: a hash or a query on the same page (e.g. list filters)
  // keeps the form. Logging out never asks.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !leavingOnPurpose.current && currentLocation.pathname !== nextLocation.pathname && nextLocation.pathname !== '/login',
  );
  const blockerRef = useRef(blocker);
  useEffect(() => {
    blockerRef.current = blocker;
  });
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirm({
      title: 'Unsaved changes',
      message: 'You have unsaved changes. Leave without saving?',
      confirmLabel: 'Leave without saving',
      cancelLabel: 'Stay on this page',
    }).then((leave) => (leave ? blockerRef.current.proceed?.() : blockerRef.current.reset?.()));
  }, [blocker.state, confirm]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const value = useMemo(() => ({ setDirty, allowLeaving }), [setDirty, allowLeaving]);
  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}
