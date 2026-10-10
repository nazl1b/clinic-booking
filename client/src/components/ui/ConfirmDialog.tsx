// Confirmation before a destructive action, instead of window.confirm.
// ConfirmDialog is the window itself; ConfirmProvider shows it for useConfirm.
//
// A modal dialog: dark backdrop, the rest of the page inert, focus starts on the
// safe button and stays inside (Tab wraps), Escape or a click outside goes back,
// and focus returns to the button that opened it. Same motion as the toasts.

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmContext, type Confirm, type ConfirmOptions } from '../../context/confirm';
import { Button } from './Button';

const EXIT_MS = 200; // same as the leave animation in index.css

interface ConfirmDialogProps {
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  leaving?: boolean; // playing the leave animation
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel = 'Go back', danger = true, leaving, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Start on the safe button, so Enter never destroys anything by accident.
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);

  // Escape closes it even if focus has somehow left the window.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Tab and Shift+Tab wrap around inside the window.
  function trapFocus(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea'));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  return (
    <div className={`dialog-backdrop${leaving ? ' dialog-leaving' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        ref={panelRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        onKeyDown={trapFocus}
      >
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
        {message && (
          <div id={messageId} className="dialog-message">
            {message}
          </div>
        )}
        <div className="dialog-actions">
          <Button variant="secondary" onClick={onCancel} data-autofocus>
            {cancelLabel}
          </Button>
          <Button danger={danger} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface OpenDialog {
  id: number;
  options: ConfirmOptions;
  leaving: boolean;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const nextId = useRef(1);
  const openId = useRef(0);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        resolveRef.current?.(false); // a dialog that was still open counts as "go back"
        resolveRef.current = resolve;
        returnFocusRef.current = options.returnFocus ?? (document.activeElement as HTMLElement | null);
        openId.current = nextId.current++;
        setDialog({ id: openId.current, options, leaving: false });
      }),
    [],
  );

  const close = useCallback((confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    const id = openId.current;
    setDialog((current) => current && { ...current, leaving: true });
    window.setTimeout(() => setDialog((latest) => (latest?.id === id ? null : latest)), EXIT_MS);
    // Back to where the user was (the page must not be inert any more for that);
    // the window fades out on top meanwhile.
    const root = document.getElementById('root');
    if (root) root.inert = false;
    returnFocusRef.current?.focus();
  }, []);

  // While open, the page behind cannot be reached (keyboard, screen reader) or scrolled.
  const open = dialog !== null && !dialog.leaving;
  useEffect(() => {
    if (!open) return;
    const root = document.getElementById('root');
    if (root) root.inert = true;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      if (root) root.inert = false;
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const onConfirm = useCallback(() => close(true), [close]);
  const onCancel = useCallback(() => close(false), [close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog &&
        createPortal(
          <ConfirmDialog key={dialog.id} {...dialog.options} leaving={dialog.leaving} onConfirm={onConfirm} onCancel={onCancel} />,
          document.body,
        )}
    </ConfirmContext.Provider>
  );
}
