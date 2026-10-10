// Shared by ConfirmProvider (shows the dialog) and useConfirm (pages that ask).
import { createContext, type ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel: string; // the action, e.g. "Cancel appointment"
  cancelLabel?: string; // default "Go back", e.g. "Keep appointment"
  danger?: boolean; // default true: the confirm button is a danger button
  returnFocus?: HTMLElement | null; // default: the element focused when asking
}

export type Confirm = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<Confirm | null>(null);
