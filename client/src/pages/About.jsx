import { Link } from 'react-router-dom';
import AboutHero from '../components/about/AboutHero';
import Icon from '../components/about/aboutIcons';
import SiteFooter from '../components/site/SiteFooter';

// Every card links to a route that exists in App.jsx and describes only what the module really does.
const OFFERS = [
  { to: '/jobs', icon: 'search', title: 'Job Discovery', text: 'Search and filter listings by role, city, work mode, type, experience and salary, then save the ones you like.' },
  { to: '/resume', icon: 'resume', title: 'Resume Analyzer', text: 'Upload a resume and get AI feedback on strengths, missing skills and suggestions, in general or against a specific job.' },
  { to: '/cover-letter', icon: 'letter', title: 'Cover Letter Generator', text: 'Draft a cover letter for a job from your resume with AI, then edit it and export it.' },
  { to: '/dashboard', icon: 'chart', title: 'Dashboard', text: 'See your applications, upcoming interviews and profile progress at a glance, based on your own activity.' },
  { to: '/applications', icon: 'tracker', title: 'Application Tracker', text: 'Record where you applied and move each application through applied, interviewing, offer or rejected.' },
  { to: '/referrals', icon: 'people', title: 'Referrals', text: 'Find employees at a company who offered to refer, send a request, and answer requests as a referrer.' },
  { to: '/programs', icon: 'program', title: 'Career Programs', text: 'Browse a curated list of learning programs and save them or track your progress. Sample content, linking to provider sites.' },
  { to: '/interviews', icon: 'calendar', title: 'Interviews', text: 'Schedule and keep track of interviews tied to your applications, with date, mode and notes.' },
];

const WHY = [
  { icon: 'brain', title: 'AI where it helps', text: 'AI powers resume analysis and cover letters. Job recommendations are rule-based, using your target role, resume skills and preferences, so you can see why a job was suggested.' },
  { icon: 'grid', title: 'Tools in one place', text: 'Discovery, resume feedback, applications, interviews and referrals share one account, so nothing lives in scattered spreadsheets.' },
  { icon: 'user', title: 'Personalised to you', text: 'Your profile, role and resume shape what you are shown and how your progress is measured.' },
  { icon: 'seed', title: 'For freshers and experienced professionals', text: 'Listings and filters cover entry-level through senior experience ranges.' },
  { icon: 'chart', title: 'Built for the long run', text: 'Your applications, saved jobs, history and progress stay in one place as your search continues.' },
];

const AUDIENCE = [
  { title: 'Freshers and graduates', text: 'Find entry-level roles and internships, and get feedback on a first resume.' },
  { title: 'Experienced professionals', text: 'Filter by experience range, tailor cover letters and keep several applications organised.' },
  { title: 'Career changers', text: 'See which skills a job asks for and how your resume lines up against it.' },
  { title: 'Employees who can refer', text: 'Opt in as a referrer for your company and respond to requests from job seekers.' },
];

const STEPS = [
  { title: 'Set up your profile', text: 'Add your target role and preferences, and upload your resume.' },
  { title: 'Discover and prepare', text: 'Browse jobs, check your resume against one, and generate a cover letter.' },
  { title: 'Apply and track', text: 'Confirm applications, schedule interviews and ask for referrals.' },
  { title: 'Review your progress', text: 'Use the dashboard to see where your search stands.' },
];

const card = 'rounded-2xl border border-sage/40 bg-white p-5 shadow-sm';
const focus = 'focus-ring';

function SectionHead({ id, eyebrow, title, intro }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold tracking-widest text-accent uppercase">{eyebrow}</p>
      <h2 id={id} className="mt-2 font-display text-3xl font-semibold text-primary">{title}</h2>
      {intro && <p className="mt-3 text-ink/80">{intro}</p>}
    </div>
  );
}

function About() {
  return (
    <div className="bg-bg">
      <AboutHero />

      <section aria-labelledby="offers-title" className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <SectionHead id="offers-title" eyebrow="Features" title="What CareerNest offers" intro="Every tool below is part of the app today. Select one to open it." />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OFFERS.map((o) => (
            <li key={o.to}>
              <Link to={o.to} className={`${focus} ${card} group flex h-full flex-col transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md`}>
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-mint text-accent"><Icon name={o.icon} className="w-6 h-6" /></span>
                <span className="mt-4 font-display text-lg font-semibold text-primary">{o.title}</span>
                <span className="mt-1.5 text-sm text-ink/75 leading-relaxed">{o.text}</span>
                <span className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
                  Open <Icon name="arrow" className="w-4 h-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="why-title" className="bg-mint/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <SectionHead id="why-title" eyebrow="Why CareerNest" title="Why choose CareerNest?" />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map((w) => (
              <li key={w.title} className={`${card} flex gap-4`}>
                <span className="grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-mint text-accent"><Icon name={w.icon} /></span>
                <div>
                  <h3 className="font-semibold text-primary">{w.title}</h3>
                  <p className="mt-1 text-sm text-ink/75 leading-relaxed">{w.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="who-title" className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHead id="who-title" eyebrow="Who it is for" title="Made for people building a career" />
            <ul className="mt-6 grid gap-3">
              {AUDIENCE.map((a) => (
                <li key={a.title} className="rounded-xl border border-sage/40 bg-white px-4 py-3">
                  <h3 className="font-semibold text-primary">{a.title}</h3>
                  <p className="text-sm text-ink/75 mt-0.5">{a.text}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHead id="how-title" eyebrow="How it works" title="A simple flow" />
            <ol className="mt-6 grid gap-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4 rounded-xl border border-sage/40 bg-white px-4 py-3">
                  <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-primary text-white text-sm font-semibold" aria-hidden="true">{i + 1}</span>
                  <div>
                    <h3 className="font-semibold text-primary"><span className="sr-only">Step {i + 1}: </span>{s.title}</h3>
                    <p className="text-sm text-ink/75 mt-0.5">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="contact-title" className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        <div className="rounded-3xl border border-sage/40 bg-mint/60 px-6 py-10 sm:px-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 id="contact-title" className="font-display text-2xl sm:text-3xl font-semibold text-primary">Questions or feedback?</h2>
            <p className="mt-2 text-ink/80">Send us a message from the Contact page and we will read it. You will find it in the app, no separate email needed.</p>
          </div>
          <Link to="/contact" className={`${focus} inline-flex items-center justify-center gap-2 min-h-11 rounded-xl bg-primary px-6 font-medium text-white hover:bg-primary-dark transition shrink-0`}>
            <Icon name="mail" className="w-5 h-5" /> Contact Us
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

export default About;
