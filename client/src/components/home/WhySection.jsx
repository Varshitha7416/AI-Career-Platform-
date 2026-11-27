import { Link } from 'react-router-dom';
import { SparkleIcon, TargetIcon, UserCheckIcon, ArrowRight } from '../dashboard/DashIcons';
import { DashboardIcon } from '../Icons';
import { WHY } from './homeData';
import { WhyScene, Sprig } from './HomeArt';

const ICONS = { ai: SparkleIcon, all: DashboardIcon, everyone: UserCheckIcon, growth: TargetIcon };
const HAND = '"Segoe Script", "Bradley Hand", "Lucida Handwriting", "Brush Script MT", cursive';

function WhySection() {
  return (
    <>
      <section aria-labelledby="home-why" className="bg-mint/50 border-y border-sage/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-center">
          <div>
            <WhyScene className="w-full max-w-md mx-auto h-auto" />
            <div className="mt-2 text-center lg:text-left">
              <span className="inline-block rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary border border-sage/40">Why choose us</span>
              <h2 id="home-why" className="mt-3 font-display text-3xl sm:text-4xl font-bold text-primary">Why CareerNest?</h2>
              <p className="mt-2 text-sm sm:text-base text-ink/70 max-w-sm mx-auto lg:mx-0">More than a job list: a place to prepare, apply and keep track of your whole job search.</p>
            </div>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {WHY.map((w) => {
              const Icon = ICONS[w.key];
              return (
                <li key={w.key} className="flex gap-3 bg-white rounded-2xl border border-sage/30 shadow-sm p-4">
                  <span className="grid place-items-center w-10 h-10 rounded-full bg-mint text-primary shrink-0"><Icon size={19} /></span>
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{w.title}</h3>
                    <p className="mt-1 text-sm text-ink/70">{w.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="home-contact" className="bg-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-6 sm:grid-cols-[1fr_auto] items-center">
          <div>
            <span className="inline-block rounded-full bg-mint px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">Get in touch</span>
            <h2 id="home-contact" className="mt-3 font-display text-3xl font-bold text-primary">Contact Us</h2>
            <p className="mt-2 text-sm sm:text-base text-ink/70 max-w-lg">We&rsquo;d love to hear from you. Send us a question, some feedback or a support request from the contact page.</p>
            <Link to="/contact" className="focus-ring mt-4 inline-flex items-center gap-2 min-h-11 rounded-xl bg-primary text-white px-5 text-sm font-medium hover:opacity-90 transition">
              Go to Contact Us <ArrowRight size={16} />
            </Link>
          </div>
          <div className="hidden sm:flex items-end gap-3" aria-hidden="true">
            <p className="text-lg text-accent -rotate-6 text-center leading-snug" style={{ fontFamily: HAND }}>Let&rsquo;s build<br />your future<br />together</p>
            <Sprig className="w-16 h-auto" />
          </div>
        </div>
      </section>
    </>
  );
}

export default WhySection;
