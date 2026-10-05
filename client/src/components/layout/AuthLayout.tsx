// Layout without sidebar for Login, Register, Forgot / Reset password and
// Accept invite: the brand on top and one centred card.

import { Link, Outlet } from 'react-router-dom';
import { Brand } from './AppLayout';

export function AuthLayout() {
  return (
    <div className="auth-shell">
      <Link to="/" className="auth-brand">
        <Brand />
      </Link>
      <main className="auth-content">
        <Outlet />
      </main>
    </div>
  );
}
