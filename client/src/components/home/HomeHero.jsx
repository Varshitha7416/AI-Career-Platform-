import { Link } from 'react-router-dom';
import { ArrowRight, BriefcaseIcon, FileIcon, PeopleIcon } from '../dashboard/DashIcons';
import { DashboardIcon, MailIcon, SkillGapIcon } from '../Icons';
import { SHORTCUTS, MORE_LINKS } from './homeData';
import { HeroScene } from './HomeArt';

const ICONS = { jobs: BriefcaseIcon, dashboard: DashboardIcon, resume: FileIcon, letter: MailIcon, skillgap: SkillGapIcon, referrals: PeopleIcon };
const HAND = '"Segoe Script", "Bradley Hand", "Lucida Handwriting", "Brush Script MT", cursive';

function HomeHero({ firstName }) {
  return (
    <section aria-labelledby="home-hello" className="relative overflow-hidden bg-mint/50 border-b border-sage/25">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 grid gap-8 lg:gap-6 lg:grid-cols-[minmax(250px,320px)_minmax(0,1fr)_minmax(300px,470px)] items-center">
        <div className="order-3 lg:order-1">
          <nav aria-label="Quick links">
            <ul className="flex flex-col gap-3">
              {SHORTCUTS.map((s) => {
                const Icon = ICONS[s.key];
                return (
                  <li key={s.key}>
                    <Link to={s.to} className="focus-ring group flex items-center gap-3 min-h-14 bg-white rounded-2xl border border-sage/30 shadow-sm px-3.5 py-2.5 hover:shadow-md hover:border-sage transition">
                      <span className="grid place-items-center w-10 h-10 rounded-full bg-mint text-primary shrink-0"><Icon size={19} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink truncate">{s.name}</span>
                        <span className="block text-xs text-ink/60 truncate">{s.hint}</span>
                      </span>
                      <ArrowRight size={16} className="text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="More pages">
            {MORE_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="focus-ring inline-flex items-center min-h-10 px-3.5 rounded-full border border-sage/60 bg-white text-sm text-primary hover:bg-white transition">{l.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="order-1 lg:order-2 text-center px-2">
          <h1 id="home-hello" className="font-display text-4xl sm:text-5xl font-bold text-primary leading-tight">
            Hi, {firstName || 'there'} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-3 font-display text-xl sm:text-2xl text-ink">Welcome back to your CareerNest!</p>
          <p className="mt-4 text-sm sm:text-base text-ink/75 max-w-md mx-auto">
            Your career companion to discover jobs, track applications and get AI help with your resume and cover letters, all in one place.
          </p>
          <p className="mt-6 text-lg text-accent" style={{ fontFamily: HAND }} aria-hidden="true">
            Better Skills → Better Opportunities → A Brighter Future
          </p>
        </div>

        <div className="order-2 lg:order-3">
          <HeroScene className="w-full max-w-md lg:max-w-none mx-auto h-auto" />
        </div>
      </div>
    </section>
  );
}

export default HomeHero;
