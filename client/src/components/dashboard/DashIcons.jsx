/* eslint-disable react-refresh/only-export-components -- icon factory: every export is a tiny component */
// Self-contained inline SVG icons for the Dashboard (stroke icons use currentColor).
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const make = (paths) => function DashIcon({ size = 20, className = '', ...rest }) {
  return (
    <svg {...base} width={size} height={size} className={className} {...rest}>
      {paths}
    </svg>
  );
};

export const SearchIcon = make(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const BriefcaseIcon = make(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>);
export const CalendarIcon = make(<><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>);
export const CapIcon = make(<><path d="m2.5 9.5 9.5-5 9.5 5-9.5 5-9.5-5Z" /><path d="M6.5 12v4.2c0 1.2 2.5 2.8 5.5 2.8s5.5-1.6 5.5-2.8V12M21.5 9.5V15" /></>);
export const UserCheckIcon = make(<><circle cx="9" cy="8" r="3.4" /><path d="M2.5 20c0-3.5 2.9-6 6.5-6 1.4 0 2.7.4 3.7 1" /><path d="m15.5 18 2 2 4-4.5" /></>);
export const ArrowRight = make(<path d="M5 12h14m-6-6 6 6-6 6" />);
export const FileIcon = make(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>);
export const RefreshIcon = make(<><path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4" /></>);
export const PeopleIcon = make(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 5.5a3 3 0 0 1 0 5.8M18 14.5c1.9.8 3 2.6 3 5.5" /></>);
export const VideoIcon = make(<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10.5 5-3v9l-5-3" /></>);
export const PhoneIcon = make(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />);
export const BuildingIcon = make(<><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" /></>);
export const PinIcon = make(<><path d="M12 21s-7-6.1-7-11a7 7 0 1 1 14 0c0 4.9-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>);
export const BulbIcon = make(<><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z" /></>);
export const TargetIcon = make(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></>);
export const SparkleIcon = make(<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />);
export const ClockIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const AlertIcon = make(<><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4M12 17.5v.1" /></>);

export function CheckCircle({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="m7 12.5 3.4 3.4L17 9" fill="none" stroke="#0B2B26" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function OpenCircle({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 3" />
    </svg>
  );
}

export function BookmarkFilled({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M6 4h12v17l-6-4-6 4V4Z" />
    </svg>
  );
}
