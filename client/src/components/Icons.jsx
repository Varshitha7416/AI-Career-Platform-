/* eslint-disable react-refresh/only-export-components -- icon factory: every export is a tiny component, nothing else is exported */
// Small inline SVG icon set (stroke icons use currentColor). No icon library dependency.
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const make = (paths) => function Icon({ size = 18, className = '', ...rest }) {
  return (
    <svg {...base} width={size} height={size} className={className} {...rest}>
      {paths}
    </svg>
  );
};

export const SearchIcon = make(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const PinIcon = make(<><path d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>);
export const BriefcaseIcon = make(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>);
export const UsersIcon = make(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5.5a3 3 0 0 1 0 5.8M18 14.5c1.9.8 3 2.6 3 5.5" /></>);
export const ClockIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const ChevronDown = make(<path d="m6 9 6 6 6-6" />);
export const ChevronLeft = make(<path d="m15 6-6 6 6 6" />);
export const ChevronRight = make(<path d="m9 6 6 6-6 6" />);
export const CheckIcon = make(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const CloseIcon = make(<path d="M6 6l12 12M18 6 6 18" />);
export const ExternalIcon = make(<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>);
export const CalendarIcon = make(<><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>);
export const ArrowLeft = make(<path d="M19 12H5m6-6-6 6 6 6" />);
export const TagIcon = make(<><path d="M3 12V4h8l9 9-8 8-9-9Z" /><circle cx="7.5" cy="8.5" r="1.2" /></>);
export const WalletIcon = make(<><path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11" /><circle cx="16.5" cy="13.5" r="1.2" /></>);
export const SparkIcon = make(<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />);
export const FilterIcon = make(<path d="M4 6h16M7 12h10M10 18h4" />);

// Bookmark can be filled (saved state).
export function BookmarkIcon({ filled = false, size = 18, className = '' }) {
  return (
    <svg {...base} width={size} height={size} className={className} fill={filled ? 'currentColor' : 'none'}>
      <path d="M6 4h12v17l-6-4-6 4V4Z" />
    </svg>
  );
}

// Brand mark (leaf pair) used in the navbar.
export function LeafLogo({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 29V16" stroke="#163832" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 17C16 10 11 5 4 5c0 7 4 12 12 12Z" fill="#235347" />
      <path d="M16 15c0-6.5 4.5-11 11-11 0 6.5-4 11-11 11Z" fill="#8EB69B" />
    </svg>
  );
}
