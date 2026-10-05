// Layout of every logged-in page: sidebar on the left, top bar with the user
// menu (Profile, Change password, Dark mode, Log out), page content on the
// right. On small screens the sidebar is hidden and opens as a drawer from ☰.

import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types';
import { ROLE_LABELS } from '../../utils/roles';
import { Icon, type IconName } from './Icon';
import { UserMenu } from './UserMenu';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

// Each role sees only its own pages.
const NAV_ITEMS: Record<Role, NavItem[]> = {
  patient: [
    { to: '/doctors', label: 'Book appointment', icon: 'calendarPlus' },
    { to: '/appointments', label: 'My appointments', icon: 'list' },
  ],
  doctor: [
    { to: '/doctor/schedule', label: 'Schedule', icon: 'calendar' },
    { to: '/doctor/appointments', label: 'Appointments', icon: 'list' },
    { to: '/doctor/availability', label: 'Working hours', icon: 'clock' },
  ],
  admin: [
    { to: '/admin/appointments', label: 'Appointments', icon: 'calendar' },
    { to: '/admin/doctors', label: 'Doctors', icon: 'users' },
  ],
};

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        +
      </span>
      <span>
        Clinic<span className="brand-accent">Booking</span>
      </span>
    </span>
  );
}

export function AppLayout() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  if (!user) return null; // RequireRole around this layout handles logged-out users

  return (
    <div className={`app-shell${menuOpen ? ' menu-open' : ''}`}>
      <aside id="sidebar" className="sidebar" aria-label="Main navigation">
        <div className="sidebar-header">
          <Brand />
          <button type="button" className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <Icon name="close" />
          </button>
        </div>
        <nav className="sidebar-nav">
          <p className="sidebar-section">{ROLE_LABELS[user.role]}</p>
          {NAV_ITEMS[user.role].map((item) => (
            <NavLink key={item.to} to={item.to} className="sidebar-link" onClick={() => setMenuOpen(false)}>
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Dark background behind the open mobile menu; a click closes it. */}
      <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-button menu-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="sidebar"
          >
            <Icon name="menu" />
          </button>
          <span className="topbar-brand">
            <Brand />
          </span>
          <div className="topbar-user">
            <UserMenu />
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
