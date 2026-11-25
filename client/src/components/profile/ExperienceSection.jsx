import { BriefcaseIcon } from '../Icons';
import { SectionCard, TextField, Field } from './ui';
import { inputClass, btnGhost, useSectionForm } from './formKit';

const blank = () => ({ company: '', title: '', startDate: '', endDate: '', current: false, description: '' });

const toDraft = (u) => {
  // Legacy users have years but no explicit level: treat as experienced when they have any years.
  const level = u.experienceLevel || (u.experienceYears > 0 ? 'experienced' : '');
  return {
    level,
    years: u.experienceYears ?? '',
    experiences: (u.experiences || []).map((e) => ({ ...blank(), ...e })),
  };
};

const toPayload = (d) => {
  if (d.level === 'fresher') return { experienceLevel: 'fresher', experienceYears: 0 };
  const body = { experienceLevel: d.level || '', experienceYears: d.years === '' ? null : Number(d.years) };
  if (d.level === 'experienced') {
    body.experiences = d.experiences
      .filter((e) => e.company.trim() || e.title.trim() || e.description.trim())
      .map((e) => ({ company: e.company, title: e.title, startDate: e.startDate, endDate: e.current ? '' : e.endDate, current: Boolean(e.current), description: e.description }));
  }
  return body;
};

function ExperienceSection({ user, onSaved }) {
  const form = useSectionForm(user, toDraft, toPayload, onSaved);
  const { draft, errors } = form;
  const list = draft.experiences;
  const update = (i, patch) => form.set({ experiences: list.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });

  return (
    <SectionCard id="experience" icon={BriefcaseIcon} title="Experience" subtitle="Tell us where you are in your career so recommendations fit." form={form}>
      <Field label="Are you a fresher or experienced?" error={errors.experienceLevel}>
        <div role="radiogroup" aria-label="Fresher or experienced" className="grid grid-cols-2 gap-2 max-w-md">
          {[['fresher', 'Fresher'], ['experienced', 'Experienced']].map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={draft.level === v}
              onClick={() => form.set({ level: v })}
              className={`focus-ring min-h-11 rounded-xl text-sm font-semibold border transition ${draft.level === v ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-sage/60 hover:bg-mint'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </Field>

      {draft.level === 'fresher' && <p className="text-sm text-ink/60 mt-3">Great, we will match you with fresher-friendly roles (saved as 0 years of experience).</p>}

      {draft.level === 'experienced' && (
        <div className="mt-4">
          <div className="max-w-xs">
            <TextField label="Total years of experience" type="number" min="0" max="50" step="0.5" inputMode="decimal" value={draft.years} onChange={(v) => form.set({ years: v })} error={errors.experienceYears} placeholder="e.g. 3" />
          </div>
          <h3 className="text-sm font-semibold text-ink mt-5 mb-2">Work history</h3>
          {list.length === 0 && <p className="text-sm text-ink/60 mb-3">No positions added yet.</p>}
          <ul className="flex flex-col gap-4">
            {list.map((e, i) => (
              <li key={i} className="rounded-xl border border-sage/30 p-4 bg-bg/40">
                <div className="grid sm:grid-cols-2 gap-3">
                  <TextField label="Company" required value={e.company} onChange={(v) => update(i, { company: v })} maxLength={100} />
                  <TextField label="Job title" required value={e.title} onChange={(v) => update(i, { title: v })} maxLength={100} />
                  <TextField label="Start month" type="month" value={e.startDate ? e.startDate.slice(0, 7) : ''} onChange={(v) => update(i, { startDate: v })} />
                  <TextField label="End month" type="month" value={e.endDate ? e.endDate.slice(0, 7) : ''} onChange={(v) => update(i, { endDate: v })} disabled={e.current} />
                  <label className="sm:col-span-2 flex items-center gap-2 text-sm text-ink min-h-10">
                    <input type="checkbox" checked={Boolean(e.current)} onChange={(ev) => update(i, { current: ev.target.checked, endDate: '' })} className="w-4 h-4 accent-emerald-800" /> I currently work here
                  </label>
                  <div className="sm:col-span-2">
                    <Field label="What you did" htmlFor={`exp-desc-${i}`}>
                      <textarea id={`exp-desc-${i}`} rows={3} maxLength={1000} value={e.description} onChange={(ev) => update(i, { description: ev.target.value })} className={`${inputClass} resize-y`} />
                    </Field>
                  </div>
                </div>
                <button type="button" onClick={() => form.set({ experiences: list.filter((_, idx) => idx !== i) })} className="focus-ring mt-3 text-sm text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 min-h-10">Remove position {i + 1}</button>
              </li>
            ))}
          </ul>
          {errors.experiences && <p role="alert" className="text-sm text-red-600 mt-3">{errors.experiences}</p>}
          <button type="button" onClick={() => form.set({ experiences: [...list, blank()] })} disabled={list.length >= 10} className={`${btnGhost} mt-4`}>+ Add position</button>
        </div>
      )}
      {!draft.level && <SelectHint />}
    </SectionCard>
  );
}

function SelectHint() {
  return <p className="text-sm text-ink/60 mt-3">Choose one to continue. This also feeds your job recommendations.</p>;
}

export default ExperienceSection;
