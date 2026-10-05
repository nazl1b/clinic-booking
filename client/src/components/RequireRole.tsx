// Route guards: the frontend twin of the requireLogin / requireRole middleware.
// They only hide pages; the API still checks permissions on every request.

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { homePathFor, useAuth } from '../context/AuthContext';
import type { Role } from '../types';
import { ButtonLink } from './ui/Button';
import { Card } from './ui/Card';
import { Muted } from './ui/PageHeader';

interface RequireRoleProps {
  roles?: Role[]; // omitted = any logged-in user
  children: ReactNode;
}

export function RequireRole({ roles, children }: RequireRoleProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Muted>Loading…</Muted>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  if (roles && !roles.includes(user.role)) {
    return (
      <Card title="No access">
        <Muted>This page is not available for your account.</Muted>
        <div>
          <ButtonLink to={homePathFor(user.role)} variant="secondary">
            Go to your home page
          </ButtonLink>
        </div>
      </Card>
    );
  }

  return <>{children}</>;
}

// Wraps Login / Register: logged-in users are sent to their home page.
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Muted>Loading…</Muted>;
  if (user) return <Navigate to={homePathFor(user.role)} replace />;
  return <>{children}</>;
}
