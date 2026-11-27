import { Link } from 'react-router-dom';
import { ArrowRight, BriefcaseIcon, FileIcon, PeopleIcon, CapIcon, UserCheckIcon, SparkleIcon, BookmarkFilled } from '../dashboard/DashIcons';
import { DashboardIcon, MailIcon, ClipboardIcon, VideoIcon, SkillGapIcon } from '../Icons';
import { FEATURES } from './homeData';
import { MiniJobs, MiniDashboard, MiniResume, MiniLetter, MiniPeople, MiniLeaves } from './HomeArt';

const ICONS = {
  jobs: BriefcaseIcon, dashboard: DashboardIcon, resume: FileIcon, letter: MailIcon, skillgap: SkillGapIcon, referrals: PeopleIcon,
  saved: BookmarkFilled, applications: ClipboardIcon, interviews: VideoIcon, programs: CapIcon, profile: UserCheckIcon,
};
const ART = { jobs: MiniJobs, dashboard: MiniDashboard, resume: MiniResume, letter: MiniLetter, people: MiniPeople };

function FeaturesSection() {
  return (
    <section aria-labelledby="home-features" className="bg-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block rounded-full bg-mint px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">What we offer</span>
          <h2 id="home-features" className="mt-3 font-display text-3xl sm:text-4xl font-bold text-primary">Features You&rsquo;ll Love</h2>
          <p className="mt-2 text-sm sm:text-base text-ink/70">Everything you need to find jobs, stay organised and prepare your applications, with AI help where it counts.</p>
        </div>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = ICONS[f.key];
            const Art = ART[f.art] || MiniLeaves;
            return (
              <li key={f.key} className="flex">
                <Link to={f.to} className="focus-ring group flex flex-col w-full bg-white rounded-2xl border border-sage/30 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition">
                  <span className="flex items-center justify-between">
                    <span className="grid place-items-center w-11 h-11 rounded-full bg-mint text-primary"><Icon size={21} /></span>
                    {f.ai && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary text-white text-[11px] font-semibold px-2 py-0.5">
                        <SparkleIcon size={11} /> AI
                      </span>
                    )}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-bold text-primary leading-snug">{f.name}</h3>
                  <p className="mt-1 text-sm text-ink/70 flex-1">{f.desc}</p>
                  <div className="mt-3 rounded-xl bg-mint/50 px-2 pt-2 overflow-hidden"><Art /></div>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Open <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default FeaturesSection;
