import { FileTextIcon, ClipboardIcon } from '../Icons';

const METHODS = [
  {
    id: 'resume',
    title: 'Use my resume',
    Icon: FileTextIcon,
    body: 'We check the skills against the text of a resume you already uploaded. Skills shown in a project or job count fully; skills only listed count half. Every match quotes your resume.',
    tag: 'Resume-verified',
  },
  {
    id: 'manual',
    title: 'Enter skills manually',
    Icon: ClipboardIcon,
    body: 'Pick the skills you have, with an optional level for each. No resume needed.',
    tag: 'Manual input',
  },
];

/** Two cards; the user only needs one method. */
function MethodChooser({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Analysis method" className="grid gap-3 sm:grid-cols-2">
      {METHODS.map(({ id, title, Icon, body, tag }) => {
        const on = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(id)}
            className={`focus-ring text-left rounded-2xl border p-5 transition ${on ? 'border-primary bg-mint shadow-sm' : 'border-sage/40 bg-white hover:bg-mint/60'}`}
          >
            <span className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-forest text-leaf flex items-center justify-center shrink-0"><Icon size={20} /></span>
              <span className="font-display text-lg font-bold text-primary">{title}</span>
            </span>
            <span className="block text-sm text-ink/70 mt-3">{body}</span>
            <span className="inline-block mt-3 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border border-sage/60 text-primary">{tag}</span>
          </button>
        );
      })}
    </div>
  );
}

export default MethodChooser;
