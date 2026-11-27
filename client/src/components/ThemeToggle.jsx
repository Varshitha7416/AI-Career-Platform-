import useTheme from '../hooks/useTheme';
import { SunIcon, MoonIcon } from './Icons';

// Light/dark switch. Shows the icon of the mode you would switch TO.
function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={dark}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      data-testid="theme-toggle"
      className="focus-ring w-10 h-10 rounded-full flex items-center justify-center text-ink/80 hover:bg-mint hover:text-primary transition"
    >
      {dark ? <SunIcon size={19} /> : <MoonIcon size={19} />}
    </button>
  );
}

export default ThemeToggle;
