// Shows the toasts sent with useToast: top centre, at most three at a time.
// Each one slides down and fades in, and slides up and fades out when it closes
// (only fades with reduced motion). Success and info close after a few seconds;
// errors stay until the user closes them with the X.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ToastContext, type ToastApi, type ToastType } from '../../context/toast';
import { Icon, type IconName } from '../layout/Icon';

const AUTO_CLOSE_MS = 4000;
const EXIT_MS = 200; // same as the leave animation in index.css
const MAX_TOASTS = 3;

const ICONS: Record<ToastType, IconName> = { success: 'checkCircle', info: 'info', error: 'alertCircle' };

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  leaving: boolean; // playing the leave animation, removed right after
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), EXIT_MS);
  }, []);

  const show = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { id, type, message, leaving: false }]);
      if (type !== 'error') timers.current.set(id, window.setTimeout(() => dismiss(id), AUTO_CLOSE_MS));
    },
    [dismiss],
  );

  // A fourth toast sends the oldest one away.
  useEffect(() => {
    const showing = toasts.filter((t) => !t.leaving);
    showing.slice(0, Math.max(0, showing.length - MAX_TOASTS)).forEach((t) => dismiss(t.id));
  }, [toasts, dismiss]);

  // No timer may fire after the app is gone.
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Outside #root, so an open dialog (which makes #root inert) does not hide them. */}
      {createPortal(
        <div className="toast-region" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast toast-${toast.type}${toast.leaving ? ' toast-leaving' : ''}`}
              role={toast.type === 'error' ? 'alert' : undefined}
            >
              <span className="toast-icon">
                <Icon name={ICONS[toast.type]} size={18} />
              </span>
              <p className="toast-message">{toast.message}</p>
              <button type="button" className="icon-button toast-close" onClick={() => dismiss(toast.id)} aria-label="Close notification">
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
