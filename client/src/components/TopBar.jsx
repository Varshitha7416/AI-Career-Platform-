import { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { getUser, clearSession } from '../utils/auth';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';
import { pageTitleFor } from './navConfig';
import { HomeIcon, InfoIcon, UserIcon, SettingsIcon, MailIcon, LogoutIcon } from './Icons';

const LINKS = [
  { to: '/home', label: 'Home', icon: HomeIcon },
  { to: '/about', label: 'About', icon: InfoIcon },
  { to: '/profile', label: 'Profile', icon: UserIcon },
];

function AvatarMenu() {
  const navigate = useNavigate();
  const user = getUser();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const go = (to) => { setOpen(false); navigate(to); };
  const logout = () => { setOpen(false); clearSession(); navigate('/login'); };
  const item = 'focus-ring w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-mint text-left';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        data-testid="avatar"
        className="focus-ring w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold"
      >
        {user?.name?.[0]?.toUpperCase() || 'U'}
      </button>
      {open && (
        <div role="menu" data-testid="avatar-menu" className="absolute right-0 top-full mt-2 w-56 z-[70] bg-white border border-sage/40 rounded-2xl shadow-xl py-2 overflow-hidden">
          <div className="px-4 pb-2 mb-1 border-b border-sage/30">
            <p className="text-sm font-semibold text-ink truncate">{user?.name || 'Your account'}</p>
            {user?.email && <p className="text-xs text-ink/60 truncate">{user.email}</p>}
          </div>
          {/* Home / About / Contact live in the top bar on wide screens; keep them reachable on small ones */}
          <div className="lg:hidden">
            <button role="menuitem" type="button" onClick={() => go('/home')} className={item}><HomeIcon size={17} /> Home</button>
            <button role="menuitem" type="button" onClick={() => go('/about')} className={item}><InfoIcon size={17} /> About</button>
          </div>
          <button role="menuitem" type="button" onClick={() => go('/profile')} className={`${item} lg:hidden`}><UserIcon size={17} /> Profile</button>
          <button role="menuitem" type="button" onClick={() => go('/profile')} className={`${item} hidden lg:flex`}><UserIcon size={17} /> Your profile</button>
          <button role="menuitem" type="button" onClick={() => go('/settings')} className={item}><SettingsIcon size={17} /> Settings</button>
          <button role="menuitem" type="button" onClick={() => go('/contact')} className={`${item} md:hidden`}><MailIcon size={17} /> Contact Us</button>
          <div className="my-1 border-t border-sage/30" />
          <button role="menuitem" type="button" onClick={logout} className={item}><LogoutIcon size={17} /> Logout</button>
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const { pathname } = useLocation();
  const title = pageTitleFor(pathname);

  const linkClass = ({ isActive }) =>
    `focus-ring inline-flex items-center min-h-10 px-3.5 rounded-full text-sm transition ${
      isActive ? 'bg-primary text-white font-medium' : 'text-ink/80 hover:bg-mint hover:text-primary'
    }`;

  return (
    <header data-testid="topbar" className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur border-b border-sage/30">
      {/* left padding leaves room for the fixed CareerNest brand area owned by <Sidebar /> */}
      <div className="h-full pl-[72px] sm:pl-[204px] pr-3 sm:pr-6 max-w-[1600px] mx-auto flex items-center gap-4">
        {title && (
          // Not a heading: each page owns its single <h1>; this is a visual breadcrumb-style label.
          <p data-testid="page-title" className="hidden md:block lg:hidden xl:block font-display text-lg font-bold text-primary truncate max-w-[14rem]">
            {title}
          </p>
        )}

        <nav aria-label="Top" className="hidden lg:flex items-center gap-1 mx-auto">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto lg:ml-0 flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <NotificationBell />
          <Link
            to="/contact"
            className="focus-ring hidden md:inline-flex items-center min-h-10 rounded-full border border-primary text-primary px-4 text-sm font-medium hover:bg-primary hover:text-white transition"
          >
            Contact Us
          </Link>
          <AvatarMenu />
        </div>
      </div>
    </header>
  );
}

export default TopBar;
