import { FileTextIcon } from '../Icons';

const STEPS = [
  { n: 1, title: 'Select a Job', text: "Tell us the role you're applying for" },
  { n: 2, title: 'Add Your Details', text: 'Share your experience and skills' },
  { n: 3, title: 'Generate', text: 'Get a tailored cover letter instantly' },
];

export function EnvelopeArt({ className = '' }) {
  return (
    <svg viewBox="0 0 240 150" className={className} role="img" aria-label="Envelope with leaves">
      <path d="M30 148c-2-30 4-56 22-78" fill="none" stroke="#8EB69B" strokeWidth="2" strokeLinecap="round" />
      <path d="M52 70c-14-2-24-12-26-26 14 0 24 10 26 26Zm-6 30c-12 0-22-8-26-20 12-2 22 6 26 20Zm10-48c-4-12 0-22 10-28 6 10 4 22-10 28Z" fill="#8EB69B" opacity="0.85" />
      <rect x="72" y="62" width="130" height="84" rx="9" fill="#DAF1DE" stroke="#8EB69B" strokeWidth="2" />
      <rect x="92" y="40" width="90" height="60" rx="5" fill="#F1F8F3" stroke="#8EB69B" strokeWidth="1.5" />
      <path d="M102 56h40M102 66h58M102 76h50" stroke="#8EB69B" strokeWidth="2.5" strokeLinecap="round" />
      <path d="m74 66 63 48 63-48" fill="none" stroke="#8EB69B" strokeWidth="2" strokeLinejoin="round" />
      <path d="M200 112c8-14 22-20 36-16-3 14-15 22-36 16Z" fill="#8EB69B" opacity="0.9" />
    </svg>
  );
}

export default function IntroPanel() {
  return (
    <aside className="rounded-2xl bg-sidebar text-leaf p-5 lg:p-6 flex flex-col lg:min-h-[560px] overflow-hidden">
      <span className="self-start text-[11px] tracking-[0.14em] uppercase px-3 py-1 rounded-md bg-sidebar-hover text-leaf-muted border border-leaf-muted/30">
        Cover Letter Generator
      </span>
      <h1 className="mt-4 font-display text-2xl lg:text-3xl leading-tight text-white flex items-center gap-2">
        Create Your Cover Letter
        <FileTextIcon size={22} className="text-leaf-muted shrink-0 hidden sm:block" />
      </h1>
      <p className="mt-3 text-sm text-leaf/85">Generate professional, personalized cover letters in seconds with the help of AI.</p>

      <ol className="hidden lg:block mt-8 space-y-6 relative">
        <span aria-hidden="true" className="absolute left-4 top-6 bottom-6 w-px bg-leaf-muted/40" />
        {STEPS.map((s) => (
          <li key={s.n} className="relative flex gap-3">
            <span className="shrink-0 w-8 h-8 rounded-full bg-sidebar-active border border-leaf-muted/60 text-white text-sm font-semibold flex items-center justify-center z-10">{s.n}</span>
            <span>
              <span className="block text-sm font-semibold text-white">{s.title}</span>
              <span className="block text-xs text-leaf/75 mt-0.5">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="hidden lg:block mt-auto pt-6 -mb-2 -ml-2">
        <EnvelopeArt className="w-full max-w-[230px]" />
      </div>
    </aside>
  );
}
