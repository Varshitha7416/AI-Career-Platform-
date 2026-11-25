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

// ---- shell / navigation icons (Agent 2) ----
export const HomeIcon = make(<><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></>);
export const DashboardIcon = make(<><rect x="3.5" y="3.5" width="7" height="8" rx="1.6" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.6" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.6" /><rect x="3.5" y="14.5" width="7" height="6" rx="1.6" /></>);
export const ClipboardIcon = make(<><rect x="5" y="4.5" width="14" height="16.5" rx="2" /><path d="M9 4.5h6v2.2H9zM8.5 11h7M8.5 15h5" /></>);
export const VideoIcon = make(<><rect x="3" y="6" width="12.5" height="12" rx="2" /><path d="m15.5 10.5 5-2.5v8l-5-2.5" /></>);
export const GraduationIcon = make(<><path d="m2.5 9 9.5-4.5L21.5 9 12 13.5 2.5 9Z" /><path d="M6.5 11.2v4.3c0 1.2 2.5 2.5 5.5 2.5s5.5-1.3 5.5-2.5v-4.3M21.5 9v5" /></>);
export const FileTextIcon = make(<><path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5l-5-5Z" /><path d="M14 3.5v5h5M9 13h6M9 16.5h6" /></>);
export const UserIcon = make(<><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.7-3.8 3.8-6 7.5-6s6.8 2.2 7.5 6" /></>);
export const SettingsIcon = make(<><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /><circle cx="12" cy="12" r="6.6" /></>);
export const MailIcon = make(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>);
export const HandshakeIcon = make(<><path d="m11 14.5 2.2 2.2a1.5 1.5 0 0 0 2.1-2.1M13 12.5l2.6 2.6a1.5 1.5 0 0 0 2.1-2.1L15 10.3" /><path d="M3 12l4.5-4.5 3 1 3-1.5 3.5 1L21 12M3 12l3 3M21 12l-3 3" /></>);
export const InfoIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.1" /></>);
export const BellIcon = make(<><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15L6 16.5Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>);
export const SunIcon = make(<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" /></>);
export const MoonIcon = make(<path d="M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />);
export const MenuIcon = make(<path d="M4 7h16M4 12h16M4 17h16" />);
export const LogoutIcon = make(<><path d="M9.5 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h3.5" /><path d="M15 8l4 4-4 4M19 12H9.5" /></>);

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
