import { forwardRef, useState } from 'react';
import { EyeIcon, EyeOffIcon, AlertIcon, CheckSmallIcon, DotIcon, Spinner, ArrowRightIcon } from './authIcons';
import { passwordChecks, passwordStrength } from './authRules';

const inputClass = (hasError, hasToggle) =>
  `w-full h-12 rounded-xl border bg-white pl-11 ${hasToggle ? 'pr-12' : 'pr-4'} text-[15px] text-ink placeholder:text-gray-500 transition
   focus:outline-none focus:ring-2 focus:ring-accent/60 focus:border-accent disabled:opacity-60
   ${hasError ? 'border-red-300 bg-red-50/40' : 'border-sage/60'}`;

export function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-red-600">
      <AlertIcon size={15} className="mt-px shrink-0" />
      <span>{message}</span>
    </p>
  );
}

// Icon-prefixed rounded input. The label is visually hidden (the placeholder carries the visible text, as in the design).
export const TextField = forwardRef(function TextField(
  { id, label, icon: Icon, error, hint, className = '', ...rest }, ref
) {
  const errId = `${id}-error`;
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="relative">
        <Icon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-accent" />
        <input
          ref={ref}
          id={id}
          placeholder={label}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errId : hint ? `${id}-hint` : undefined}
          className={inputClass(Boolean(error), false)}
          {...rest}
        />
      </div>
      <FieldError id={errId} message={error} />
    </div>
  );
});

export const PasswordField = forwardRef(function PasswordField(
  { id, label, icon: Icon, error, describedBy, className = '', ...rest }, ref
) {
  const [shown, setShown] = useState(false);
  const errId = `${id}-error`;
  const described = [error ? errId : null, describedBy].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="relative">
        <Icon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-accent" />
        <input
          ref={ref}
          id={id}
          type={shown ? 'text' : 'password'}
          placeholder={label}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={described}
          className={inputClass(Boolean(error), true)}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={shown}
          className="focus-ring absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-accent hover:bg-mint"
        >
          {shown ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>
      <FieldError id={errId} message={error} />
    </div>
  );
});

const SEGMENT = ['', 'bg-red-500', 'bg-amber-500', 'bg-lime-600', 'bg-accent'];

// Live strength meter + the requirement checklist (mirrors the server policy).
export function PasswordStrength({ id, password, name, email }) {
  const ctx = { name, email };
  const { score, label } = passwordStrength(password, ctx);
  const checks = passwordChecks(password, ctx);
  return (
    <div id={id} className="mt-2.5 rounded-xl bg-mint/60 px-3.5 py-3" data-testid="password-strength">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? SEGMENT[score] : 'bg-sage/40'}`} />
          ))}
        </div>
        <span className="min-w-[4.5rem] text-right text-xs font-semibold text-primary" aria-live="polite">
          {password ? `${label} password` : 'Strength'}
        </span>
      </div>
      <ul className="mt-2.5 grid gap-1 text-[13px] sm:grid-cols-2">
        {checks.map((c) => (
          <li key={c.id} className={`flex items-center gap-1.5 ${c.met ? 'text-primary' : 'text-gray-600'}`}>
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${c.met ? 'bg-accent text-white' : 'border border-sage/70 text-transparent'}`}>
              {c.met ? <CheckSmallIcon size={11} /> : <DotIcon size={6} />}
            </span>
            <span>{c.label}<span className="sr-only">{c.met ? ' (met)' : ' (not met yet)'}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SubmitButton({ loading, loadingText, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading}
      className="focus-ring flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? (<><Spinner size={18} /><span>{loadingText}</span></>) : (<><span>{children}</span><ArrowRightIcon size={18} /></>)}
    </button>
  );
}

// Persistent live region so screen readers announce banners as they appear.
export function Banner({ children, tone = 'error' }) {
  const styles = tone === 'success' ? 'bg-mint text-primary' : 'bg-red-50 text-red-700';
  return (
    <div aria-live="polite" aria-atomic="true" data-testid="auth-banner">
      {children && (
        <div className={`mb-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${styles}`}>
          {tone === 'success' ? <CheckSmallIcon size={17} className="mt-0.5 shrink-0" /> : <AlertIcon size={17} className="mt-0.5 shrink-0" />}
          <span>{children}</span>
        </div>
      )}
    </div>
  );
}
