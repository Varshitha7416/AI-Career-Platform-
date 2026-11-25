import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { greetingFor } from './format';
import { SearchIcon, ArrowRight } from './DashIcons';
import { HeroIllustration } from './Botanical';

const SUGGESTIONS = ['Software Engineer', 'Data Analyst', 'Frontend Developer', 'Internship'];

// Greeting + job search. Submitting goes to Job Discovery (/jobs) with the query applied.
function DashboardHero({ firstName }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  // Computed once per mount so it doesn't flicker; good enough for a page that is re-opened often.
  const [greeting] = useState(() => greetingFor());

  const go = (text) => {
    const query = String(text ?? q).trim();
    navigate(query ? `/jobs?q=${encodeURIComponent(query)}` : '/jobs');
  };

  return (
    <section className="hero-bg border-b border-sage/30 relative overflow-hidden" aria-labelledby="dash-greeting">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-10 grid lg:grid-cols-[minmax(0,1fr)_360px] gap-8 items-center">
        <div>
          <span className="inline-block text-[11px] font-semibold tracking-[0.14em] text-primary bg-sage/40 rounded-md px-2.5 py-1">YOUR DASHBOARD</span>
          <h1 id="dash-greeting" className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] leading-tight font-bold text-primary mt-3">
            {greeting}{firstName ? `, ${firstName}` : ''}!
          </h1>
          <p className="text-ink/75 mt-2 max-w-xl">
            Welcome back to your career journey. Track your progress, discover opportunities and take the next step with confidence.
          </p>

          <form onSubmit={(e) => { e.preventDefault(); go(); }} role="search" className="mt-6 flex flex-col sm:flex-row gap-3 max-w-2xl">
            <div className="relative flex-1">
              <SearchIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/60 pointer-events-none" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search jobs, internships or roles…"
                aria-label="Search jobs, internships or roles"
                className="focus-ring w-full bg-white border border-sage/50 rounded-xl pl-11 pr-3 py-3 text-sm"
              />
            </div>
            <button type="submit" className="focus-ring inline-flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-primary-dark transition">
              Search <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Popular searches">
            <span className="text-xs text-ink/60 mr-1">Popular:</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => go(s)}
                className="focus-ring text-xs px-3 py-1.5 rounded-full border border-sage/60 bg-mint/70 text-primary hover:bg-mint hover:border-primary transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden lg:block h-[280px]"><HeroIllustration className="w-full h-full" /></div>
      </div>
    </section>
  );
}

export default DashboardHero;
