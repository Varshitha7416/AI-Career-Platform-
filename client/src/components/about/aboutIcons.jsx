// Small inline stroke icons for the About page (no icon library in this project).
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const PATHS = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  resume: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>,
  letter: <><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="m4 8 8 6 8-6" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  tracker: <><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M9 3v3M15 3v3M8 12l2.5 2.5L16 9" /></>,
  people: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M17 14c2.4 0 4 1.8 4 4.5" /></>,
  program: <><path d="M3 9l9-5 9 5-9 5z" /><path d="M7 11.5V16c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.5" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></>,
  brain: <><path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V4a3 3 0 0 0-3 0Z" /><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.8 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-4 3.1-6.5 7-6.5s7 2.5 7 6.5" /></>,
  seed: <><path d="M12 21v-9" /><path d="M12 13c0-4 2.5-6.5 7-7 .3 4.6-2.2 7-7 7Z" /><path d="M12 15c0-3-2-5-6-5.3-.2 3.6 1.8 5.3 6 5.3Z" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  mail: <><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="m4 8 8 6 8-6" /></>,
};

export default function Icon({ name, className = 'w-5 h-5' }) {
  return <svg {...base} className={className}>{PATHS[name]}</svg>;
}
