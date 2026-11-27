import { useState, useEffect, useRef } from 'react';

import { NAV_ITEMS } from './navItems';

const monthYear = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '');

// Left card: initials avatar (no photo upload exists), identity, member-since and the section navigation.
// The highlighted item follows the section under a reading line near the top of the viewport (scroll position),
// the last section wins once the page bottom is reached, and a click highlights immediately and holds that choice
// until the smooth scroll it started has finished.
function ProfileNav({ user }) {
  const [active, setActive] = useState('account');
  const navRef = useRef(null);
  const lockRef = useRef(false);

  useEffect(() => {
    let frame = 0;
    const compute = () => {
      frame = 0;
      if (lockRef.current) return;
      const line = 140; // px from the viewport top (below the sticky top bar)
      let current = NAV_ITEMS[0].id;
      NAV_ITEMS.forEach((n) => {
        const el = document.getElementById(n.id);
        if (el && el.getBoundingClientRect().top <= line) current = n.id;
      });
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) current = NAV_ITEMS[NAV_ITEMS.length - 1].id;
      setActive(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(compute); };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Mobile horizontal scroller: keep the active pill visible (horizontal scroll of the strip only).
  useEffect(() => {
    const nav = navRef.current;
    const btn = nav?.querySelector('[aria-current="true"]');
    if (!nav || !btn || nav.scrollWidth <= nav.clientWidth + 1) return;
    const left = btn.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [active]);

  const go = (id) => {
    setActive(id);
    lockRef.current = true;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // After the lock expires, re-sync with where the page actually ended up.
    setTimeout(() => { lockRef.current = false; window.dispatchEvent(new Event('scroll')); }, 950);
  };

  const since = monthYear(user.createdAt);
  return (
    <div className="bg-white rounded-2xl border border-sage/30 shadow-sm p-4 sm:p-5">
      <div className="flex lg:flex-col items-center gap-3 lg:gap-0 lg:text-center">
        <div className="w-14 h-14 lg:w-24 lg:h-24 shrink-0 rounded-full bg-primary text-white flex items-center justify-center text-2xl lg:text-4xl font-display font-bold" aria-hidden="true">
          {(user.name || 'U')[0].toUpperCase()}
        </div>
        <div className="min-w-0 lg:mt-3">
          <h2 className="font-display text-lg lg:text-xl font-bold text-primary truncate">{user.name}</h2>
          <p className="text-sm text-ink/65 truncate">{user.email}</p>
          {since && <p className="inline-block mt-1.5 text-xs px-3 py-1 rounded-full bg-mint text-primary">Member since {since}</p>}
        </div>
      </div>
      <nav ref={navRef} aria-label="Profile sections" className="mt-4 relative -mx-1 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
        {NAV_ITEMS.map((n) => {
          const Icon = n.icon;
          const on = active === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => go(n.id)}
              aria-current={on ? 'true' : undefined}
              className={`focus-ring shrink-0 flex items-center gap-2.5 min-h-11 px-3 rounded-xl text-sm whitespace-nowrap transition ${on ? 'bg-mint text-primary font-semibold lg:border-l-4 lg:border-accent' : 'text-ink/75 hover:bg-mint/60'}`}
            >
              <Icon size={18} /> {n.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default ProfileNav;
