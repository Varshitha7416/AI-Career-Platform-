import { useState, useId } from 'react';
import { inputClass, btnPrimary, btnGhost } from './formKit';
import { CheckIcon } from '../Icons';

export function Field({ label, error, hint, children, htmlFor, required }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink mb-1">
        {label}{required && <span className="text-red-600" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error ? <p role="alert" className="text-xs text-red-600 mt-1">{error}</p> : hint ? <p className="text-xs text-ink/55 mt-1">{hint}</p> : null}
    </div>
  );
}

export function TextField({ label, value, onChange, error, hint, required, type = 'text', ...rest }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id} required={required}>
      <input id={id} type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} className={`${inputClass} ${error ? 'border-red-400' : ''}`} {...rest} />
    </Field>
  );
}

export function SelectField({ label, value, onChange, error, children, ...rest }) {
  const id = useId();
  return (
    <Field label={label} error={error} htmlFor={id}>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={inputClass} {...rest}>{children}</select>
    </Field>
  );
}

// Card with title, optional per-section save bar showing unsaved / saved / error state.
export function SectionCard({ id, icon, title, subtitle, children, form, hideSave = false, saveLabel = 'Save changes' }) {
  const Icon = icon;
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 bg-white rounded-2xl border border-sage/30 shadow-sm p-5 sm:p-6">
      <header className="flex items-start gap-3 mb-4">
        {Icon && <span className="shrink-0 w-10 h-10 rounded-xl bg-mint text-primary flex items-center justify-center"><Icon size={20} /></span>}
        <div className="min-w-0">
          <h2 id={`${id}-h`} className="font-display text-xl font-bold text-primary leading-tight">{title}</h2>
          {subtitle && <p className="text-sm text-ink/60 mt-0.5">{subtitle}</p>}
        </div>
      </header>
      {children}
      {form && !hideSave && (
        <div className="mt-5 pt-4 border-t border-sage/25 flex flex-wrap items-center justify-between gap-3">
          <SaveState form={form} />
          <div className="flex gap-2">
            {form.dirty && !form.saving && <button type="button" onClick={form.reset} className={btnGhost}>Discard</button>}
            <button type="button" onClick={() => form.save()} disabled={!form.dirty || form.saving} className={btnPrimary}>{form.saving ? 'Saving...' : saveLabel}</button>
          </div>
        </div>
      )}
    </section>
  );
}

export function SaveState({ form }) {
  if (form.status?.type === 'error') return <p role="alert" className="text-sm text-red-600 flex-1 min-w-[200px]">{form.status.text}</p>;
  if (form.dirty) return <p role="status" className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" /> Unsaved changes</p>;
  if (form.status?.type === 'success') return <p role="status" className="text-sm text-accent flex items-center gap-1.5"><CheckIcon size={16} /> {form.status.text}</p>;
  return <p className="text-sm text-ink/50">No unsaved changes</p>;
}

// Small removable tag chips with an add input (Enter or comma adds).
export function TagInput({ label, items, onChange, max, maxLen = 40, placeholder, suggestions = [], hint, error }) {
  const id = useId();
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const add = (raw) => {
    const v = raw.trim().replace(/\s+/g, ' ');
    if (!v) return;
    if (v.length > maxLen) return setMsg(`Keep it to ${maxLen} characters or fewer.`);
    if (items.some((i) => i.name.toLowerCase() === v.toLowerCase())) { setText(''); return setMsg(`"${v}" is already added.`); }
    if (items.length >= max) return setMsg(`You can add up to ${max}.`);
    onChange([...items, { name: v }]);
    setText('');
    setMsg('');
  };
  const remove = (name) => onChange(items.filter((i) => i.name !== name));
  const free = suggestions.filter((s) => !items.some((i) => i.name.toLowerCase() === s.toLowerCase())).slice(0, 6);
  return (
    <Field label={label} htmlFor={id} error={msg || error} hint={hint}>
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mb-2" aria-label={label}>
          {items.map((i) => (
            <li key={i.name} className="inline-flex items-center gap-1 text-xs sm:text-sm pl-3 pr-0.5 py-1 rounded-full bg-mint text-primary font-medium">
              {i.name}{i.level ? <span className="text-ink/55 font-normal"> · {i.level}</span> : null}
              <button type="button" onClick={() => remove(i.name)} aria-label={`Remove ${i.name}`} className="focus-ring group -my-2 flex w-11 h-11 items-center justify-center rounded-full leading-none text-base"><span className="flex w-6 h-6 items-center justify-center rounded-full group-hover:bg-sage/40" aria-hidden="true">&times;</span></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          value={text}
          maxLength={maxLen + 5}
          disabled={items.length >= max}
          onChange={(e) => { setText(e.target.value); setMsg(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text); } }}
          placeholder={items.length >= max ? `Maximum ${max} reached` : placeholder}
          className={inputClass}
        />
        <button type="button" onClick={() => add(text)} disabled={!text.trim() || items.length >= max} className={btnGhost}>Add</button>
      </div>
      {free.length > 0 && items.length < max && (
        <div className="flex flex-wrap gap-1.5 mt-2" aria-label="Suggestions">
          {free.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="focus-ring inline-flex items-center min-h-10 text-xs px-3 rounded-full border border-dashed border-sage text-primary hover:bg-mint">+ {s}</button>
          ))}
        </div>
      )}
    </Field>
  );
}
