import { GraduationIcon } from '../Icons';
import { SectionCard, TextField } from './ui';
import { btnGhost, useSectionForm } from './formKit';

const blank = () => ({ institution: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '', grade: '' });
const toDraft = (u) => ({ education: (u.education || []).map((e) => ({ ...blank(), ...e, startYear: e.startYear ?? '', endYear: e.endYear ?? '' })) });
const toPayload = (d) => ({
  education: d.education.filter((e) => Object.values(e).some((v) => String(v).trim())).map((e) => ({
    institution: e.institution, degree: e.degree, fieldOfStudy: e.fieldOfStudy, grade: e.grade,
    startYear: e.startYear === '' ? undefined : Number(e.startYear), endYear: e.endYear === '' ? undefined : Number(e.endYear),
  })),
});

function EducationSection({ user, onSaved }) {
  const form = useSectionForm(user, toDraft, toPayload, onSaved);
  const list = form.draft.education;
  const update = (i, patch) => form.set({ education: list.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });
  const remove = (i) => form.set({ education: list.filter((_, idx) => idx !== i) });
  return (
    <SectionCard id="education" icon={GraduationIcon} title="Education" subtitle="Add your degrees, diplomas or courses (up to 10)." form={form}>
      {list.length === 0 && <p className="text-sm text-ink/60 mb-3">No education added yet.</p>}
      <ul className="flex flex-col gap-4">
        {list.map((e, i) => (
          <li key={i} className="rounded-xl border border-sage/30 p-4 bg-bg/40">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><TextField label="Institution" required value={e.institution} onChange={(v) => update(i, { institution: v })} maxLength={120} /></div>
              <TextField label="Degree" value={e.degree} onChange={(v) => update(i, { degree: v })} maxLength={100} placeholder="e.g. B.Tech" />
              <TextField label="Field of study" value={e.fieldOfStudy} onChange={(v) => update(i, { fieldOfStudy: v })} maxLength={100} placeholder="e.g. Computer Science" />
              <TextField label="Start year" type="number" inputMode="numeric" value={e.startYear} onChange={(v) => update(i, { startYear: v })} placeholder="2019" />
              <TextField label="End year (or expected)" type="number" inputMode="numeric" value={e.endYear} onChange={(v) => update(i, { endYear: v })} placeholder="2023" />
              <TextField label="Grade / CGPA" value={e.grade} onChange={(v) => update(i, { grade: v })} maxLength={30} />
            </div>
            <button type="button" onClick={() => remove(i)} className="focus-ring mt-3 text-sm text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 min-h-10">Remove entry {i + 1}</button>
          </li>
        ))}
      </ul>
      {form.errors.education && <p role="alert" className="text-sm text-red-600 mt-3">{form.errors.education}</p>}
      <button type="button" onClick={() => form.set({ education: [...list, blank()] })} disabled={list.length >= 10} className={`${btnGhost} mt-4`}>+ Add education</button>
    </SectionCard>
  );
}

export default EducationSection;
