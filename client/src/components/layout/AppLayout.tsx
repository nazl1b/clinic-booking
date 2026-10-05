// Layout of every logged-in page: sidebar on the left, top bar with the user's
// name and Log out, page content on the right. On small screens the sidebar is
// hidden and opens as a drawer from the ☰ button.

import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types';
import { Button } from '../ui/Button';
import { Icon, type IconName } from './Icon';
import { ThemeToggle } from './ThemeToggle';

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
    { to: '/doctor/availability', label: 'Working hours', icon: 'clock' },
  ],
  admin: [
    { to: '/admin/appointments', label: 'Appointments', icon: 'calendar' },
    { to: '/admin/doctors', label: 'Doctors', icon: 'users' },
  ],
};

const ACCOUNT_ITEMS: NavItem[] = [{ to: '/profile', label: 'Profile', icon: 'user' }];

const ROLE_LABELS: Record<Role, string> = { patient: 'Patient', doctor: 'Doctor', admin: 'Administrator' };

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
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  if (!user) return null; // RequireRole around this layout handles logged-out users

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const renderLinks = (items: NavItem[]) =>
    items.map((item) => (
      <NavLink key={item.to} to={item.to} className="sidebar-link" onClick={() => setMenuOpen(false)}>
        <Icon name={item.icon} />
        {item.label}
      </NavLink>
    ));

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
          {renderLinks(NAV_ITEMS[user.role])}
          <p className="sidebar-section">Account</p>
          {renderLinks(ACCOUNT_ITEMS)}
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
            <ThemeToggle />
            <NavLink to="/profile" className="user-chip" title={user.email}>
              <span className="avatar avatar-sm" aria-hidden="true">
                {user.name.replace('Dr. ', '').charAt(0)}
              </span>
              <span className="user-chip-text">
                <span className="user-chip-name">{user.name}</span>
                <span className="user-chip-role">{ROLE_LABELS[user.role]}</span>
              </span>
            </NavLink>
            <Button variant="tertiary" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
