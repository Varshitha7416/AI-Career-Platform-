import AboutIllustration from './AboutIllustration';
import Icon from './aboutIcons';

const HAND = '"Segoe Script", "Bradley Hand", "Lucida Handwriting", "Brush Script MT", cursive';

// Chips describe things that exist: rule-based job matching, AI resume analysis, dashboard progress, the product promise.
const CHIPS = [
  { icon: 'sparkle', lines: ['Smarter', 'Job Matches'], pos: 'sm:left-[4%] sm:top-[6%]' },
  { icon: 'brain', lines: ['AI-Powered', 'Insights'], pos: 'sm:right-[0%] sm:top-[2%]' },
  { icon: 'chart', lines: ['Personalized', 'Growth Tracking'], pos: 'sm:left-[0%] sm:top-[34%]' },
  { icon: 'heart', lines: ['Your Career,', 'Our Priority'], pos: 'sm:right-[0%] sm:top-[68%]' },
];

function Chip({ icon, lines, pos }) {
  return (
    <li className={`flex items-center gap-2.5 rounded-2xl border border-sage/50 bg-white px-3.5 py-2.5 shadow-md sm:absolute ${pos}`}>
      <span className="grid place-items-center w-9 h-9 shrink-0 rounded-xl bg-mint text-accent"><Icon name={icon} /></span>
      <span className="text-sm font-semibold leading-tight text-ink">{lines[0]}<br />{lines[1]}</span>
    </li>
  );
}

export default function AboutHero() {
  return (
    <section aria-labelledby="about-title" className="hero-bg relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-16 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-sage/60 bg-white/80 px-3 py-1 text-xs font-semibold tracking-widest text-accent">
            <Icon name="seed" className="w-3.5 h-3.5" /> ABOUT CAREERNEST
          </span>
          <h1 id="about-title" className="mt-5 font-display font-semibold text-primary text-3xl sm:text-4xl xl:text-[44px] leading-tight text-balance">
            More Than Just a Job Search
            <span className="block italic font-normal">It&rsquo;s Your Career Companion.</span>
          </h1>
          <p className="mt-6 text-ink/85 text-base sm:text-lg leading-relaxed max-w-xl">
            CareerNest is an AI-assisted platform built to help you explore opportunities, understand your resume and keep
            your search organised. Job discovery, applications, interview scheduling, referrals and career programs all
            live in one place.
          </p>
          <p className="mt-4 text-ink/85 text-base sm:text-lg leading-relaxed max-w-md">
            Because a career isn&rsquo;t just a destination, it&rsquo;s a journey, and we&rsquo;re here for every step.
          </p>
          <p className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xl text-accent" style={{ fontFamily: HAND, fontStyle: 'italic' }} aria-label="Build, Grow, Achieve">
            <span>Build</span><span aria-hidden="true" className="text-lg">&rarr;</span>
            <span>Grow</span><span aria-hidden="true" className="text-lg">&rarr;</span>
            <span>Achieve</span>
          </p>
        </div>

        <div className="relative">
          <AboutIllustration className="w-full max-w-xl mx-auto h-auto" />
          <ul className="mt-4 grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:mt-0 sm:block">
            {CHIPS.map((c) => <Chip key={c.lines[0]} {...c} />)}
          </ul>
        </div>
      </div>
    </section>
  );
}
