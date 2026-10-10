// Shared by ToastProvider (shows the toasts) and useToast (pages that send them).
import { createContext } from 'react';

export type ToastType = 'success' | 'info' | 'error';

export interface ToastApi {
  show: (type: ToastType, message: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);
