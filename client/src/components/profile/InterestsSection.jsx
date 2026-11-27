import { useState, useEffect, useId, useRef } from 'react';
import axiosClient from '../../api/axiosClient';
import { SparkIcon } from '../Icons';
import { SectionCard, Field } from './ui';
import { inputClass, btnGhost, useSectionForm } from './formKit';

const MAX = 3;
const norm = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();

const toDraft = (u) => ({ interests: (u.careerInterests || []).map((i) => i.role), primary: u.primaryRole || '' });
const toPayload = (d) => ({ careerInterests: d.interests, primaryRole: d.primary || (d.interests[0] || '') });

function StarIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8L12 3.5Z" />
    </svg>
  );
}

function InterestsSection({ user, onSaved }) {
  const [note, setNote] = useState('');
  const form = useSectionForm(user, toDraft, toPayload, (data) => {
    setNote(data.resumesUnassigned ? `${data.resumesUnassigned} resume${data.resumesUnassigned === 1 ? ' was' : 's were'} un-assigned because its role was removed. Nothing was deleted.` : '');
    if (onSaved) onSaved(data);
  });
  const { draft } = form;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [msg, setMsg] = useState('');
  const listId = useId();
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => {
      axiosClient.get('/auth/roles', { params: { q: query.trim() } }).then((r) => setSuggestions(r.data.roles || [])).catch(() => setSuggestions([]));
    }, 180);
    return () => clearTimeout(t);
  }, [query, open]);

  const add = (raw) => {
    const role = raw.trim().replace(/\s+/g, ' ');
    if (!role) return;
    if (role.length > 80) return setMsg('A role can be at most 80 characters.');
    if (draft.interests.some((r) => norm(r) === norm(role))) { setQuery(''); return setMsg(`"${role}" is already one of your career interests.`); }
    if (draft.interests.length >= MAX) return setMsg(`You can choose up to ${MAX} career interests. Remove one to add another.`);
    const interests = [...draft.interests, role];
    form.set({ interests, primary: draft.primary || role });
    setQuery('');
    setMsg('');
    setOpen(false);
  };
  const remove = (role) => {
    const interests = draft.interests.filter((r) => r !== role);
    form.set({ interests, primary: draft.primary === role ? (interests[0] || '') : draft.primary });
    setMsg('');
  };
  const shown = suggestions.filter((s) => !draft.interests.some((r) => norm(r) === norm(s)));
  const full = draft.interests.length >= MAX;

  return (
    <SectionCard id="interests" icon={SparkIcon} title="Career Interests" subtitle={`Pick up to ${MAX} roles you want. Star one as your primary role. Each role can have its own resume.`} form={form}>
      {draft.interests.length === 0 ? (
        <p className="text-sm text-ink/60 mb-3">No career interests yet. Add the roles you are aiming for to get matched jobs per role.</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-4" aria-label="Your career interests">
          {draft.interests.map((role) => {
            const primary = norm(draft.primary) === norm(role);
            return (
              <li key={role} className="flex items-center gap-2 rounded-xl border border-sage/40 bg-bg/40 pl-3 pr-1.5 py-1.5">
                <span className="font-medium text-sm text-ink truncate min-w-0 flex-1">{role}</span>
                {primary && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent text-white">Primary</span>}
                <button type="button" onClick={() => form.set({ primary: role })} aria-pressed={primary} aria-label={primary ? `${role} is your primary role` : `Make ${role} your primary role`} className={`focus-ring w-10 h-10 rounded-lg flex items-center justify-center ${primary ? 'text-accent' : 'text-ink/40 hover:text-accent hover:bg-mint'}`}>
                  <StarIcon filled={primary} />
                </button>
                <button type="button" onClick={() => remove(role)} aria-label={`Remove ${role}`} className="focus-ring w-11 h-11 rounded-lg text-red-600 hover:bg-red-50 text-lg leading-none">&times;</button>
              </li>
            );
          })}
        </ul>
      )}

      <Field label="Add a role" htmlFor={`${listId}-in`} error={msg || form.errors.careerInterests || form.errors.primaryRole} hint={full ? `You have ${MAX} of ${MAX}. Remove one to add another.` : 'Search common roles, or type your own and press Enter.'}>
        <div className="relative">
          <input
            id={`${listId}-in`}
            ref={inputRef}
            role="combobox"
            aria-expanded={open && shown.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            value={query}
            disabled={full}
            maxLength={80}
            placeholder={full ? 'Maximum reached' : 'e.g. Data Analyst'}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); setMsg(''); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(query); } if (e.key === 'Escape') setOpen(false); }}
            className={inputClass}
          />
          {open && !full && shown.length > 0 && (
            <ul id={listId} role="listbox" className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-xl border border-sage/50 bg-white shadow-lg py-1">
              {shown.map((s) => (
                <li key={s} role="option" aria-selected="false">
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s)} className="focus-ring w-full text-left px-3 py-2.5 text-sm text-ink hover:bg-mint">{s}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>
      <div className="mt-2">
        <button type="button" onClick={() => add(query)} disabled={!query.trim() || full} className={btnGhost}>Add role</button>
      </div>
      <p className="text-xs text-ink/55 mt-3">Removing a role un-assigns its resume. The resume stays in your library and is never deleted.</p>
      {note && <p role="status" className="text-sm text-accent mt-2">{note}</p>}
    </SectionCard>
  );
}

export default InterestsSection;
