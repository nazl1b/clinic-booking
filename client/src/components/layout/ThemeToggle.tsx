// Light / dark icon button, used on the auth pages (logged-in pages switch the
// theme from the user menu).

import { useTheme } from '../../utils/theme';
import { Icon } from './Icon';

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button type="button" className="icon-button theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={label} title={label}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}
