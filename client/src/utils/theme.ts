// Light / dark theme, shared by every component that shows or changes it
// (the user menu, and the toggle on the auth pages).
//
// The first visit follows the system setting; once the user picks a theme it
// is saved in localStorage. index.html applies the theme before the first
// paint, so the page never flashes the wrong colours.

import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const listeners = new Set<() => void>();

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  listeners.forEach((listener) => listener());
}

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null; // storage blocked (e.g. private mode)
  }
}

// Until the user picks a theme, follow changes of the system setting.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!savedTheme()) applyTheme(e.matches ? 'dark' : 'light');
});

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage blocked: the choice still applies until the page is reloaded
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  return [useSyncExternalStore(subscribe, currentTheme), setTheme];
}
