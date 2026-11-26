import { useState, useRef, useEffect } from 'react';
import { fetchSkills } from '../../api/skillGap';
import useSkillGapSuggestions from '../../hooks/useSkillGapSuggestions';
import { CloseIcon } from '../Icons';
import { FIELD, LEVELS, BTN_GHOST, MAX_SKILLS } from './skillGapUtils';

const skillFetcher = async (q, signal) => (await fetchSkills(q, signal)).skills || [];
const norm = (s) => s.trim().toLowerCase();

/**
 * Searchable skill picker. skills = [{ name, level? }]. Suggestions come from GET /skill-gap/skills;
 * a custom skill can be added with Enter or the Add button. Duplicates are ignored. Level is optional.
 */
function SkillSelector({ skills, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const wrapRef = useRef(null);
  const { items } = useSkillGapSuggestions(skillFetcher, query, open);

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const has = (name) => skills.some((s) => norm(s.name) === norm(name));
  const shown = items.filter((s) => !has(s.name)).slice(0, 8);

  const add = (raw) => {
    const name = raw.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!name) return;
    if (has(name)) { setNote(`"${name}" is already in your list.`); setQuery(''); return; }
    if (skills.length >= MAX_SKILLS) { setNote(`You can add up to ${MAX_SKILLS} skills.`); return; }
    setNote('');
    onChange([...skills, { name }]);
    setQuery('');
  };

  const setLevel = (name, level) => onChange(skills.map((s) => (s.name === name ? { name: s.name, ...(level ? { level } : {}) } : s)));
  const remove = (name) => onChange(skills.filter((s) => s.name !== name));

  return (
    <div>
      <div ref={wrapRef} className="relative">
        <label htmlFor="sg-skill-input" className="block text-sm font-medium text-ink mb-1">Add your skills</label>
        <div className="flex gap-2">
          <input
            id="sg-skill-input"
            type="text"
            role="combobox"
            aria-expanded={open && shown.length > 0}
            aria-controls="sg-skill-list"
            aria-autocomplete="list"
            autoComplete="off"
            maxLength={80}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); setNote(''); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); add(query); }
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Search skills, or type your own and press Enter"
            className={FIELD}
          />
          <button type="button" onClick={() => add(query)} disabled={!query.trim()} className={`${BTN_GHOST} shrink-0`}>Add</button>
        </div>
        {open && shown.length > 0 && (
          <ul id="sg-skill-list" role="listbox" className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-sage/40 rounded-lg shadow-lg py-1">
            {shown.map((s) => (
              <li key={s.key || s.name} role="option" aria-selected={false}>
                <button type="button" onClick={() => add(s.name)} className="focus-ring w-full text-left px-3 py-2 text-sm text-ink hover:bg-mint">{s.name}</button>
              </li>
            ))}
          </ul>
        )}
        {note && <p role="status" className="text-xs text-amber-700 mt-1">{note}</p>}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-ink">
          Your skills <span className="text-ink/60 font-normal">({skills.length}/{MAX_SKILLS})</span>
        </p>
        {skills.length === 0 ? (
          <p className="text-sm text-ink/60 mt-1">No skills added yet. Add at least one to run the analysis.</p>
        ) : (
          <>
            <p className="text-xs text-ink/60 mt-1">A level is optional. If you skip it, the skill is counted as listed without a self-rating.</p>
            <ul className="mt-2 flex flex-col gap-2">
              {skills.map((s) => (
                <li key={s.name} className="flex flex-wrap items-center gap-2 rounded-lg border border-sage/40 px-3 py-2">
                  <span className="text-sm font-medium text-ink flex-1 min-w-[8rem] break-words">{s.name}</span>
                  <label className="sr-only" htmlFor={`lvl-${s.name}`}>Level for {s.name}</label>
                  <select
                    id={`lvl-${s.name}`}
                    value={s.level || ''}
                    onChange={(e) => setLevel(s.name, e.target.value)}
                    className="border border-sage/60 rounded-lg px-2 py-1 text-xs"
                  >
                    <option value="">Level: skip</option>
                    {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                  <button type="button" onClick={() => remove(s.name)} aria-label={`Remove ${s.name}`} className="focus-ring p-1 rounded text-ink/60 hover:bg-mint">
                    <CloseIcon size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export default SkillSelector;
