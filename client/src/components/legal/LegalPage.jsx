import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Layout from '../Layout';
import ThemeToggle from '../ThemeToggle';
import SiteFooter from '../site/SiteFooter';
import { isLoggedIn } from '../../utils/auth';

export const LEGAL_UPDATED = '2026-11-25';
export const LEGAL_UPDATED_LABEL = 'November 25, 2026';

const linkCls = 'focus-ring inline-flex items-center min-h-10 rounded-lg px-3 text-sm font-medium text-primary hover:bg-mint transition';

// Public (logged-out) wrapper: brand, links back to sign up / log in, theme toggle. Logged-in visitors get the shared Layout.
function PublicShell({ children }) {
  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <header className="border-b border-sage/30 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-16 flex items-center justify-between gap-2">
          <Link to="/login" className="focus-ring inline-flex items-center min-h-10 font-display text-xl font-semibold text-primary rounded-lg">CareerNest</Link>
          <nav aria-label="Account" className="flex items-center gap-1">
            <Link to="/login" className={linkCls}>Log in</Link>
            <Link to="/signup" className="focus-ring inline-flex items-center min-h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark transition">Sign up</Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="border-t border-sage/30 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/60">
          <Link to="/terms" className="focus-ring inline-flex items-center min-h-10 px-2 hover:text-primary">Terms of Service</Link>
          <Link to="/privacy" className="focus-ring inline-flex items-center min-h-10 px-2 hover:text-primary">Privacy Policy</Link>
          <span className="px-2">&copy; {new Date().getFullYear()} CareerNest</span>
        </div>
      </footer>
    </div>
  );
}

// sections: [{ id, title, body: ReactNode }]
export default function LegalPage({ title, intro, sections, other }) {
  const [active, setActive] = useState(sections[0].id);
  const loggedIn = isLoggedIn();
  const { hash } = useLocation();

  // react-router does not scroll to #hash on navigation, so do it here.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) el.scrollIntoView({ block: 'start' });
  }, [hash]);

  useEffect(() => {
    document.title = `${title} | CareerNest`;
    let frame = 0;
    const compute = () => {
      frame = 0;
      let cur = sections[0].id;
      sections.forEach((s) => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 120) cur = s.id;
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = sections[sections.length - 1].id;
      setActive(cur);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(compute); };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [title, sections]);

  const body = (
    <div className="bg-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">Legal</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold text-primary text-balance">{title}</h1>
          <p className="mt-3 text-sm text-ink/70">Last updated: <time dateTime={LEGAL_UPDATED}>{LEGAL_UPDATED_LABEL}</time></p>
          <p role="note" className="mt-4 rounded-xl border border-sage/60 bg-mint/70 px-4 py-3 text-sm text-primary">
            <strong className="font-semibold">Draft notice.</strong> This document is a draft written to describe how CareerNest currently works. It has not had legal review.
          </p>
          <p className="mt-4 text-ink/85 leading-relaxed">{intro}</p>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] items-start">
          <nav aria-label="On this page" className="min-w-0 lg:sticky lg:top-20 rounded-2xl border border-sage/30 bg-white p-3">
            <p className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink/60">On this page</p>
            <ol className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
              {sections.map((s, i) => (
                <li key={s.id} className="shrink-0">
                  <a
                    href={`#${s.id}`}
                    onClick={() => setActive(s.id)}
                    aria-current={active === s.id ? 'true' : undefined}
                    className={`focus-ring flex items-center min-h-10 px-3 rounded-lg text-sm whitespace-nowrap lg:whitespace-normal transition ${active === s.id ? 'bg-mint text-primary font-semibold' : 'text-ink/75 hover:bg-mint/60'}`}
                  >
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="min-w-0 rounded-2xl border border-sage/30 bg-white p-5 sm:p-8 shadow-sm">
            {sections.map((s, i) => (
              <section key={s.id} aria-labelledby={s.id} className={i ? 'mt-8 pt-8 border-t border-sage/25' : ''}>
                <h2 id={s.id} className="scroll-mt-24 font-display text-xl font-semibold text-primary">{i + 1}. {s.title}</h2>
                <div className="mt-3 space-y-3 text-ink/85 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:text-primary [&_a]:underline [&_a]:font-medium">{s.body}</div>
              </section>
            ))}
          </article>
        </div>

        <p className="mt-8 text-sm text-ink/70">
          Also read our{' '}
          <Link to={other.to} className="focus-ring inline-flex items-center min-h-10 text-primary underline font-medium">{other.label}</Link>.
        </p>
      </div>
      {loggedIn && <SiteFooter />}
    </div>
  );

  return loggedIn ? <Layout>{body}</Layout> : <PublicShell>{body}</PublicShell>;
}
