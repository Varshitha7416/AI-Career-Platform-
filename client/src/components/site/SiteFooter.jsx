import { Link } from 'react-router-dom';

// Shared footer for the public-facing style pages (Home, About). Lead-owned: do not fork it, ask for changes.
// Only real routes and real information are shown: no invented addresses, emails or social accounts.
const PRODUCT_LINKS = [
  { to: '/jobs', label: 'Job Discovery' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/resume', label: 'Resume Analyzer' },
  { to: '/cover-letter', label: 'Cover Letter' },
  { to: '/referrals', label: 'Referrals' },
];
const COMPANY_LINKS = [
  { to: '/home', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/profile', label: 'Profile' },
  { to: '/contact', label: 'Contact Us' },
  { to: '/terms', label: 'Terms of Service' },
  { to: '/privacy', label: 'Privacy Policy' },
];

function LeafMark({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 21v-8" />
      <path d="M12 13c0-4 2.5-6.5 7-7 .3 4.6-2.2 7-7 7Z" />
      <path d="M12 15c0-3-2-5-6-5.3-.2 3.6 1.8 5.3 6 5.3Z" />
    </svg>
  );
}

export default function SiteFooter() {
  const link = 'focus-ring inline-flex items-center min-h-10 text-sm text-ink/75 hover:text-primary transition';
  return (
    <footer className="border-t border-sage/30 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2 font-display text-xl font-semibold text-primary">
            <LeafMark className="w-6 h-6" /> CareerNest
          </p>
          <p className="mt-2 text-sm text-ink/70 max-w-xs">Your career journey, all in one nest.</p>
          <Link to="/contact" className="focus-ring mt-4 inline-flex items-center min-h-10 rounded-xl border border-sage px-4 text-sm font-medium text-primary hover:bg-mint transition">
            Contact Us
          </Link>
        </div>
        <nav aria-label="Platform">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/60 mb-1">Platform</p>
          <ul>{PRODUCT_LINKS.map((l) => <li key={l.to}><Link to={l.to} className={link}>{l.label}</Link></li>)}</ul>
        </nav>
        <nav aria-label="Company">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/60 mb-1">CareerNest</p>
          <ul>{COMPANY_LINKS.map((l) => <li key={l.to}><Link to={l.to} className={link}>{l.label}</Link></li>)}</ul>
        </nav>
      </div>
      <div className="border-t border-sage/30">
        <p className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-xs text-ink/60 flex items-center gap-2">
          <LeafMark className="w-4 h-4" /> © {new Date().getFullYear()} CareerNest. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
