// Light / dark switch. The first visit follows the system setting; once the
// user picks a theme it is saved in localStorage. index.html applies the
// theme before the first paint, so the page never flashes the wrong colours.

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null; // storage blocked (e.g. private mode)
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Until the user picks a theme, follow changes of the system setting.
  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => {
      if (!savedTheme()) setTheme(e.matches ? 'dark' : 'light');
    };
    systemDark.addEventListener('change', onChange);
    return () => systemDark.removeEventListener('change', onChange);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage blocked: the choice still applies until the page is reloaded
    }
  }

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button type="button" className="icon-button theme-toggle" onClick={toggle} aria-label={label} title={label}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}
