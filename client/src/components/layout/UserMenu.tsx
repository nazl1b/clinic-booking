// User menu in the top bar: the avatar and name open a dropdown with Profile,
// Change password, a Dark mode switch and Log out. Same in every panel.
//
// The menu closes:
//  - on a click outside it, on Escape, or when an item is chosen
//  - 1 second after the mouse leaves it (coming back before that keeps it open).
//    Only for a real mouse: on touch screens there is no "leave", so it closes
//    only with a tap outside or by choosing an item.

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../utils/roles';
import { useTheme } from '../../utils/theme';
import { Icon } from './Icon';

const CLOSE_DELAY_MS = 1000;

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const menuId = useId();

  // The focusable items of the open menu, in order.
  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);

  const cancelDelayedClose = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
  }, []);

  const close = useCallback(
    (returnFocus = false) => {
      cancelDelayedClose();
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [cancelDelayedClose],
  );

  // A click (or tap) outside closes the menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  // Focus the first item when the menu opens, for keyboard users.
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
  }, [open]);

  // No timer may fire after the menu is gone.
  useEffect(() => cancelDelayedClose, [cancelDelayedClose]);

  if (!user) return null;

  function handlePointerLeave(e: PointerEvent) {
    if (!open || e.pointerType !== 'mouse') return;
    cancelDelayedClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }

  function handlePointerEnter(e: PointerEvent) {
    if (e.pointerType === 'mouse') cancelDelayedClose();
  }

  // Arrow keys move between items, Escape closes, Tab leaves the menu.
  function handleMenuKeyDown(e: KeyboardEvent) {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => list[(i + list.length) % list.length]?.focus();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusAt(index - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusAt(0);
        break;
      case 'End':
        e.preventDefault();
        focusAt(list.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        close(true);
        break;
      case 'Tab':
        close();
        break;
    }
  }

  async function handleLogout() {
    close();
    await logout();
    navigate('/login');
  }

  const initial = user.name.replace('Dr. ', '').charAt(0);

  return (
    <div className={`user-menu${open ? ' open' : ''}`} ref={rootRef} onPointerLeave={handlePointerLeave} onPointerEnter={handlePointerEnter}>
      <button
        ref={triggerRef}
        type="button"
        className="user-chip user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="avatar avatar-sm" aria-hidden="true">
          {initial}
        </span>
        <span className="user-chip-text">
          <span className="user-chip-name">{user.name}</span>
          <span className="user-chip-role">{ROLE_LABELS[user.role]}</span>
        </span>
        <span className="user-menu-chevron">
          <Icon name="chevronDown" size={16} />
        </span>
      </button>

      {open && (
        <div id={menuId} ref={menuRef} className="user-menu-panel" role="menu" aria-label="Account" onKeyDown={handleMenuKeyDown}>
          <div className="user-menu-header">
            <span className="user-menu-name">{user.name}</span>
            <span className="user-menu-email">{user.email}</span>
          </div>

          <Link to="/profile" role="menuitem" className="user-menu-item" onClick={() => close()}>
            <Icon name="user" size={18} />
            Profile
          </Link>
          <Link to="/profile#change-password" role="menuitem" className="user-menu-item" onClick={() => close()}>
            <Icon name="lock" size={18} />
            Change password
          </Link>
          {/* A setting, not a destination: the menu stays open so the change is visible. */}
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={theme === 'dark'}
            className="user-menu-item"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Icon name="moon" size={18} />
            Dark mode
            <span className="switch" aria-hidden="true" />
          </button>

          <div className="user-menu-separator" role="separator" />

          <button type="button" role="menuitem" className="user-menu-item" onClick={handleLogout}>
            <Icon name="logout" size={18} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
