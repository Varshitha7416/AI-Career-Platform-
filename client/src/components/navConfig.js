import {
  DashboardIcon, SearchIcon, BookmarkIcon, ClipboardIcon, VideoIcon, GraduationIcon,
  FileTextIcon, MailIcon, HandshakeIcon, UserIcon, SettingsIcon,
} from './Icons';

// Sidebar navigation. The job-search item reads "Find Jobs" in the sidebar (explicit product requirement);
// everywhere else the same page is called "Job Discovery" (see PAGE_TITLES). Route paths never change.
export const NAV_GROUPS = [
  {
    label: 'Menu',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
      { to: '/jobs', label: 'Find Jobs', icon: SearchIcon },
      { to: '/saved-jobs', label: 'Saved Jobs', icon: BookmarkIcon },
      { to: '/applications', label: 'Applications', icon: ClipboardIcon },
      { to: '/interviews', label: 'Interviews', icon: VideoIcon },
      { to: '/programs', label: 'Career Programs', icon: GraduationIcon },
    ],
  },
  {
    label: 'Career tools',
    items: [
      { to: '/resume', label: 'Resume AI', icon: FileTextIcon },
      { to: '/cover-letter', label: 'Cover Letter', icon: MailIcon },
      { to: '/referrals', label: 'Referrals', icon: HandshakeIcon },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/profile', label: 'Profile', icon: UserIcon },
      { to: '/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

// Longest matching prefix wins. The dashboard has its own greeting, so it shows no page title in the top bar.
const PAGE_TITLES = [
  ['/home', 'Home'],
  ['/jobs', 'Job Discovery'],
  ['/saved-jobs', 'Saved Jobs'],
  ['/applications', 'Applications'],
  ['/interviews', 'Interviews'],
  ['/programs', 'Career Programs'],
  ['/resume', 'Resume AI'],
  ['/cover-letter', 'Cover Letter'],
  ['/referrals', 'Referrals'],
  ['/about', 'About'],
  ['/profile', 'Profile'],
  ['/settings', 'Settings'],
  ['/contact', 'Contact Us'],
  ['/terms', 'Terms of Service'],
  ['/privacy', 'Privacy Policy'],
];

const DETAIL_TITLES = {
  '/jobs/': 'Job Details',
  '/applications/': 'Application Details',
  '/programs/': 'Program Details',
  '/referrals/': 'Referral Details',
};

export function pageTitleFor(pathname) {
  if (pathname === '/dashboard') return '';
  if (pathname === '/referrals/find') return 'Find People';
  for (const [prefix, title] of Object.entries(DETAIL_TITLES)) {
    if (pathname.startsWith(prefix) && pathname.length > prefix.length) return title;
  }
  const hit = PAGE_TITLES
    .filter(([p]) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? hit[1] : '';
}
