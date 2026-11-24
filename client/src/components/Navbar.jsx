import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { getUser, clearSession } from '../utils/auth';
import { LeafLogo } from './Icons';

const links = [
  { to: '/home', label: 'Home' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/resume', label: 'Resume AI' },
  { to: '/cover-letter', label: 'Cover Letter' },
  { to: '/referrals', label: 'Referrals' },
  { to: '/about', label: 'About' },
  { to: '/profile', label: 'Profile' },
];

function Navbar() {
  const navigate = useNavigate();
  const user = getUser();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `focus-ring px-3 py-1.5 rounded-full text-sm transition ${
      isActive ? 'bg-primary text-white font-medium' : 'text-ink/80 hover:bg-mint hover:text-primary'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-sage/30">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4" aria-label="Main">
        <Link to="/home" className="focus-ring flex items-center gap-2 shrink-0 rounded-lg">
          <LeafLogo />
          <span className="font-display text-xl font-bold text-primary">CareerNest</span>
        </Link>

        <div className="hidden lg:flex items-center gap-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>{l.label}</NavLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link to="/profile" className="focus-ring hidden sm:flex items-center gap-2 rounded-full" aria-label="Your profile">
            <span className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </span>
            <span className="text-sm text-ink/80 hidden xl:inline">Hi, {user?.name?.split(' ')[0] || 'there'}</span>
          </Link>
          <button
            onClick={handleLogout}
            className="focus-ring text-sm border border-primary text-primary px-4 py-1.5 rounded-full hover:bg-primary hover:text-white transition"
          >
            Logout
          </button>
          <button
            type="button"
            className="focus-ring lg:hidden p-2 rounded-lg text-primary hover:bg-mint"
            aria-label="Toggle navigation menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="lg:hidden border-t border-sage/30 bg-white px-4 py-3 flex flex-wrap gap-2">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass} onClick={() => setOpen(false)}>{l.label}</NavLink>
          ))}
        </div>
      )}
    </header>
  );
}

export default Navbar;
