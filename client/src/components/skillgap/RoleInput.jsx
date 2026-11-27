import { useState, useRef, useEffect } from 'react';
import { fetchRoles } from '../../api/skillGap';
import useSkillGapSuggestions from '../../hooks/useSkillGapSuggestions';
import { FIELD } from './skillGapUtils';

const roleFetcher = async (q, signal) => (await fetchRoles(q, signal)).roles || [];

/** Role text field with suggestions from GET /skill-gap/roles. Free text is allowed (custom roles). */
function RoleInput({ id, label, value, onChange, hint, interests = [] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const { items } = useSkillGapSuggestions(roleFetcher, value, open);

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (r) => { onChange(r); setOpen(false); };
  const listId = `${id}-list`;
  const shown = items.filter((r) => r.toLowerCase() !== value.trim().toLowerCase()).slice(0, 8);

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1">{label}</label>
      {interests.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs text-ink/60">From your profile:</span>
          {interests.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => pick(r)}
              aria-pressed={value.trim().toLowerCase() === r.toLowerCase()}
              className={`focus-ring text-xs px-3 py-1 rounded-full border ${value.trim().toLowerCase() === r.toLowerCase() ? 'bg-primary text-white border-primary' : 'border-sage/60 text-primary hover:bg-mint'}`}
            >
              {r}
            </button>
          ))}
        </div>
      )}
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open && shown.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        maxLength={120}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        placeholder="e.g. Frontend Developer"
        className={FIELD}
      />
      {hint && <p className="text-xs text-ink/60 mt-1">{hint}</p>}
      {open && shown.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-sage/40 rounded-lg shadow-lg py-1">
          {shown.map((r) => (
            <li key={r} role="option" aria-selected={false}>
              <button type="button" onClick={() => pick(r)} className="focus-ring w-full text-left px-3 py-2 text-sm text-ink hover:bg-mint">{r}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RoleInput;
