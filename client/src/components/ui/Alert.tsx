import type { ReactNode } from 'react';

interface AlertProps {
  type?: 'error' | 'success' | 'info' | 'warning';
  children: ReactNode;
}

// Message box for errors and confirmations. Renders nothing when empty.
export function Alert({ type = 'info', children }: AlertProps) {
  if (!children) return null;
  return (
    <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
