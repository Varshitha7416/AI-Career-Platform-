/* eslint-disable react-refresh/only-export-components -- icon factory: every export is a tiny component */
// Stroke icons used only by the auth screens (currentColor, decorative).
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' };

const make = (paths) => function Icon({ size = 18, className = '' }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      {paths}
    </svg>
  );
};

export const MailIcon = make(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></>);
export const LockIcon = make(<><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5" /></>);
export const UserIcon = make(<><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.7-3.8 3.8-6 7.5-6s6.8 2.2 7.5 6" /></>);
export const EyeIcon = make(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>);
export const EyeOffIcon = make(<><path d="M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.6 7.4A15.700 15.700 0 0 0 2.5 12S6 18.500 12 18.500c1.600 0 3-.4 4.200-1" /><path d="M9.900 9.900a3 3 0 0 0 4.200 4.200M3.500 3.500l17 17" /></>);
export const ArrowRightIcon = make(<path d="M5 12h14m-6-6 6 6-6 6" />);
export const CheckSmallIcon = make(<path d="m5 12.500 4.500 4.500L19 7.500" />);
export const DotIcon = make(<circle cx="12" cy="12" r="3" />);
export const AlertIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7.500v5.500M12 16.500v.1" /></>);

export function Spinner({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
