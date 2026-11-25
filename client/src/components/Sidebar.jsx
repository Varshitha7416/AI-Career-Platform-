import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft } from './Icons';
import { NAV_GROUPS } from './navConfig';

// Soft botanical decoration for the bottom of the panel.
function LeafDecor() {
  return (
    <svg viewBox="0 0 280 150" className="absolute bottom-0 left-0 w-full h-auto pointer-events-none select-none" aria-hidden="true">
      <g opacity="0.55">
        <path d="M30 150C8 112 14 70 52 40c26 30 26 74-22 110Z" fill="#235347" />
        <path d="M30 150c-4-34 4-66 22-110" stroke="#8EB69B" strokeWidth="1.6" fill="none" opacity="0.6" />
        <path d="M86 152c-22-26-18-62 10-92 26 24 22 64-10 92Z" fill="#163832" />
        <path d="M230 152c22-34 14-76-24-108-30 32-22 78 24 108Z" fill="#235347" />
        <path d="M262 152c14-26 8-58-16-84-22 26-16 60 16 84Z" fill="#8EB69B" opacity="0.5" />
        <circle cx="168" cy="118" r="26" fill="#163832" opacity="0.7" />
        <path d="M168 144c-3-16 0-30 8-44M168 132c-8-4-12-12-10-20 8 0 14 6 14 14" stroke="#8EB69B" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function BrandMark({ size = 40 }) {
  return (
    <span
      className="shrink-0 rounded-xl bg-sidebar flex items-center justify-center shadow-sm ring-1 ring-leaf-muted/30"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.64} height={size * 0.64} viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 29V16" stroke="#DAF1DE" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M16 17C16 10 11 5 4 5c0 7 4 12 12 12Z" fill="#8EB69B" />
        <path d="M16 15c0-6.5 4.5-11 11-11 0 6.5-4 11-11 11Z" fill="#DAF1DE" />
      </svg>
    </span>
  );
}

/**
 * Collapsible CareerNest navigation.
 *  - Collapsed: only the compact brand area (logo tile + wordmark) is visible at the top-left.
 *  - Hovering the brand area (mouse) OR clicking it expands the full sidebar as an overlay (content is not pushed).
 *  - Click toggles a "pinned" state; leaving with the mouse collapses it unless pinned. Esc / outside click closes it.
 *  - On touch devices there is no hover: tap the brand area to open a drawer with a backdrop; picking an item closes it.
 */
function Sidebar() {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [suppress, setSuppress] = useState(false); // after un-pinning while the pointer is still over it, stay closed
  const wrapRef = useRef(null);
  const expanded = pinned || (hover && !suppress);

  const toggle = useCallback(() => {
    if (pinned) {
      setPinned(false);
      setSuppress(true);
    } else {
      setPinned(true);
    }
  }, [pinned]);

  const close = useCallback(() => {
    setPinned(false);
    setSuppress(true);
  }, []);

  const onPointerEnter = (e) => {
    if (e.pointerType === 'mouse') setHover(true);
  };
  const onPointerLeave = (e) => {
    if (e.pointerType === 'mouse') {
      setHover(false);
      setSuppress(false);
    }
  };

  // Esc closes; a pointer-down outside closes a pinned panel.
  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) close(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [expanded, close]);

  // Choosing a destination closes the drawer on small screens (desktop keeps a pinned panel as the user left it).
  const onNavigate = () => {
    if (!window.matchMedia('(min-width: 1024px)').matches) close();
  };

  return (
    <div ref={wrapRef} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} data-testid="sidebar-root">
      {/* Mobile/tablet backdrop */}
      <div
        onClick={close}
        aria-hidden="true"
        className={`sidebar-backdrop fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Collapsed brand area (always rendered; the panel covers it when expanded) */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls="app-sidebar"
        aria-label="CareerNest menu"
        data-testid="brand-toggle"
        className="focus-ring fixed top-0 left-0 z-40 h-16 flex items-center gap-2.5 pl-4 pr-3 rounded-br-2xl"
      >
        <BrandMark />
        <span className="hidden sm:inline font-display text-xl font-bold text-primary">CareerNest</span>
      </button>

      {/* Expanded panel */}
      <aside
        id="app-sidebar"
        aria-label="Primary navigation"
        inert={!expanded}
        data-state={expanded ? 'open' : 'closed'}
        className={`sidebar-panel fixed inset-y-0 left-0 z-50 w-72 max-w-[86vw] flex flex-col overflow-hidden text-leaf
          bg-linear-to-b from-sidebar via-sidebar to-sidebar-deep
          transition-[transform,visibility] duration-200 ease-out
          ${expanded ? 'visible translate-x-0 shadow-2xl shadow-black/40' : 'invisible -translate-x-full pointer-events-none shadow-none'}`}
      >
        <div className="h-16 shrink-0 flex items-center justify-between pl-4 pr-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={pinned ? 'Unpin menu' : 'Pin menu open'}
            aria-pressed={pinned}
            className="focus-ring flex items-center gap-2.5 rounded-xl"
          >
            <BrandMark />
            <span className="font-display text-xl font-bold text-leaf">CareerNest</span>
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Collapse menu"
            className="focus-ring p-2 rounded-lg text-leaf-muted hover:bg-sidebar-hover hover:text-leaf"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <nav aria-label="Primary" className="relative z-10 flex-1 overflow-y-auto px-3 pb-6 pt-1">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mt-4 first:mt-1">
              <p className="px-3.5 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf-muted/80">{group.label}</p>
              <ul className="space-y-1">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `focus-ring group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                          isActive ? 'bg-sidebar-active text-white font-medium' : 'text-leaf/85 hover:bg-sidebar-hover hover:text-white'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-leaf-muted" aria-hidden="true" />}
                          <Icon size={19} className={isActive ? 'text-leaf' : 'text-leaf-muted group-hover:text-leaf'} />
                          <span>{label}</span>
                          {isActive && <span className="sr-only">(current page)</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="relative shrink-0 h-[92px] hidden [@media(min-height:760px)]:block" aria-hidden="true">
          <LeafDecor />
          <p className="absolute left-5 bottom-3 right-5 text-[11px] leading-snug text-leaf-muted">Grow your career, one step at a time.</p>
        </div>
      </aside>
    </div>
  );
}

export default Sidebar;
