// Shared by UnsavedChangesProvider (asks before leaving) and useUnsavedChanges (forms).
import { createContext } from 'react';

export interface UnsavedChanges {
  setDirty: (formId: string, dirty: boolean) => void; // a form has (or no longer has) unsaved changes
  allowLeaving: () => void; // the next navigation goes through without asking (e.g. after saving)
}

export const UnsavedChangesContext = createContext<UnsavedChanges | null>(null);
